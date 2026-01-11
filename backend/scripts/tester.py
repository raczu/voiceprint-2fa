import argparse
import asyncio
import logging
import re
import sys
import uuid
from collections import defaultdict
from http import HTTPStatus
from pathlib import Path
from typing import Literal, Self, cast

import httpx
import numpy as np
from pydantic import BaseModel, Field, RootModel
from tabulate import tabulate

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logging.getLogger("httpx").disabled = True
logging.getLogger("httpcore").disabled = True

logger = logging.getLogger(__name__)

FILENAME_PATTERN = re.compile(
    r"^(?P<user>[^-]+)-(?P<dur>long|short)-(?P<maintype>enr|ver)(?:-(?P<subtype>sick|spoofing))?(?:-(?P<idx>\d+))?\.wav$"
)


class Scenario(BaseModel):
    name: str
    duration: Literal["short", "long"]
    enrollments: int


class RecordingMetadata(BaseModel):
    id: int | None = None
    type: Literal["enrollment", "verification", "spoof", "sick"]
    duration: Literal["short", "long"]


class Recording(BaseModel):
    file: Path
    metadata: RecordingMetadata


class UserRecordings(RootModel):
    root: list[Recording]

    def __iter__(self):
        return iter(self.root)

    def __getitem__(self, item):
        return self.root[item]

    def filter(self, duration: str, type: str) -> list[Path]:
        return [
            rec.file
            for rec in self.root
            if rec.metadata.duration == duration and rec.metadata.type == type
        ]

    @classmethod
    def from_paths(cls, paths: list[Path]) -> Self:
        recordings = []
        for filename in paths:
            match = FILENAME_PATTERN.match(filename.name)
            if not match:
                logger.warning("Filename does not match pattern, skipping: %s", filename)
                continue

            groups = match.groupdict()
            rectype = "enrollment" if groups["maintype"] == "enr" else "verification"
            if groups.get("subtype") == "sick":
                rectype = "sick"
            elif groups.get("subtype") == "spoofing":
                rectype = "spoof"
            metadata = RecordingMetadata(
                id=int(groups["idx"]) if groups.get("idx") else None,
                type=cast(Literal["enrollment", "verification", "spoof", "sick"], rectype),
                duration=groups["dur"],
            )
            recordings.append(Recording(file=filename, metadata=metadata))
        return cls(root=recordings)


class UserGroup(BaseModel):
    id: uuid.UUID = Field(default_factory=uuid.uuid4)
    username: str
    recordings: UserRecordings


class ResearchResult(BaseModel):
    user: str
    scenario: str
    duration: str
    enrollments: int
    type: str
    score: float
    repetition: int


class BatchResults(RootModel):
    root: list[ResearchResult]

    def summary(self) -> None:
        if not self.root:
            logger.warning("No results to summarize")
            return

        grouped = defaultdict(lambda: defaultdict(list))
        for result in self.root:
            grouped[result.scenario][result.type].append(result.score)

        data = []
        order = {"verification": 0, "imposter": 1, "sick": 2, "spoof": 3}
        for scenario, tests in sorted(grouped.items()):
            data.append([f"SCENARIO: {scenario}", "", ""])
            for ttype in sorted(tests.keys(), key=lambda x: order.get(x, 999)):
                scores = tests[ttype]
                avg = np.mean(scores)
                std = np.std(scores)
                data.append([f"  > {ttype}", f"{avg:.4f}", f"{std:.4f}"])

        output = tabulate(
            data,
            headers=["TEST TYPE / SCENARIO", "AVG SCORE", "STD DEV"],
            tablefmt="fancy_grid",
            colalign=("left", "right", "right"),
        )
        logger.info("\n%s", output)


class VoiceprintResearch:
    _SCENARIOS: list[Scenario] = [
        Scenario(name="S1_SHORT_5", duration="short", enrollments=5),
        Scenario(name="S2_LONG_5", duration="long", enrollments=5),
        Scenario(name="S3_SHORT_3", duration="short", enrollments=3),
        Scenario(name="S4_LONG_3", duration="long", enrollments=3),
    ]
    _ENR_ENDPOINT: str = "/api/v1/private/enroll"
    _VER_ENDPOINT: str = "/api/v1/private/verify"
    _FIXED_TESTS: tuple[str, ...] = ("verification", "spoof", "sick")
    _FIXED_TESTS_REPETITIONS: int = 10
    _IMPOSTER_TEST_REPETITIONS: int = 10

    def __init__(self, data: Path) -> None:
        self._users = self._load_registry(data)

    @staticmethod
    def _load_registry(data: Path) -> list[UserGroup]:
        files = list(data.glob("*.wav"))
        mapping = defaultdict(list)

        for file in files:
            match = FILENAME_PATTERN.match(file.name)
            if not match:
                logger.warning("Filename does not match pattern, skipping: %s", file)
                continue
            username = match.group("user")
            mapping[username].append(file)

        return [
            UserGroup(username=username, recordings=UserRecordings.from_paths(paths))
            for username, paths in mapping.items()
        ]

    async def _get_score(self, client: httpx.AsyncClient, uid: str, file: Path) -> float:
        response = await client.post(
            f"{self._VER_ENDPOINT}/{uid}", files={"file": file.read_bytes()}
        )
        if response.status_code not in (HTTPStatus.OK, HTTPStatus.UNAUTHORIZED):
            response.raise_for_status()
        return float(response.json()["score"])

    async def _enroll_user(self, client: httpx.AsyncClient, uid: str, files: list[Path]) -> None:
        payload = [("files", (f.name, f.read_bytes(), "audio/wav")) for f in files]
        response = await client.post(f"{self._ENR_ENDPOINT}/{uid}", files=payload)
        response.raise_for_status()

    async def _run_fixed_tests(
        self, client: httpx.AsyncClient, scenario: Scenario, user: UserGroup, uid: str
    ) -> list[ResearchResult]:
        results = []
        for ttype in self._FIXED_TESTS:
            files = user.recordings.filter(duration=scenario.duration, type=ttype)
            if not files:
                raise ValueError(
                    f"No {ttype} recordings found for user {user.username} "
                    f"with duration {scenario.duration}"
                )

            file = files[0]
            for rep in range(1, self._FIXED_TESTS_REPETITIONS + 1):
                score = await self._get_score(client, uid, file)
                result = ResearchResult(
                    user=user.username,
                    scenario=scenario.name,
                    duration=scenario.duration,
                    enrollments=scenario.enrollments,
                    type=ttype,
                    score=score,
                    repetition=rep,
                )
                results.append(result)
        return results

    async def _run_imposter_tests(
        self,
        client: httpx.AsyncClient,
        scenario: Scenario,
        user: UserGroup,
        uid: str,
    ) -> list[ResearchResult]:
        results = []
        others = [u for u in self._users if u.username != user.username]
        for rep in range(1, self._IMPOSTER_TEST_REPETITIONS + 1):
            imposter = np.random.choice(others)
            files = imposter.recordings.filter(duration=scenario.duration, type="verification")
            if not files:
                raise ValueError(
                    f"No verification recordings found for imposter user {imposter.username} "
                    f"with duration {scenario.duration}"
                )

            file = files[0]
            score = await self._get_score(client, uid, file)
            result = ResearchResult(
                user=user.username,
                scenario=scenario.name,
                duration=scenario.duration,
                enrollments=scenario.enrollments,
                type="imposter",
                score=score,
                repetition=rep,
            )
            results.append(result)
        return results

    @staticmethod
    def _get_test_uid(user: UserGroup, scenario: Scenario) -> str:
        return f"{user.id}{scenario.name}".replace("-", "").replace("_", "")

    async def _enroll_phase(self, client: httpx.AsyncClient, scenario: Scenario) -> None:
        logger.info("▶ PHASE 1: enrollment")
        for user in self._users:
            uid = self._get_test_uid(user, scenario)
            files = user.recordings.filter(duration=scenario.duration, type="enrollment")[
                : scenario.enrollments
            ]
            if not files:
                raise ValueError(f"No enrollment recordings found for user {user.username}")

            logger.info("Enrolling user (%s)...", user.username)
            await self._enroll_user(client, uid, files)

    async def _test_phase(
        self, client: httpx.AsyncClient, scenario: Scenario
    ) -> list[ResearchResult]:
        logger.info("▶ PHASE 2: testing")
        results = []
        for user in self._users:
            uid = self._get_test_uid(user, scenario)
            logger.info("Running all tests for user (%s)...", user.username)
            results.extend(await self._run_fixed_tests(client, scenario, user, uid))
            results.extend(await self._run_imposter_tests(client, scenario, user, uid))
        return results

    async def run(self, client: httpx.AsyncClient) -> BatchResults:
        results = []
        for sc in self._SCENARIOS:
            logger.info("▶ SCENARIO: %s", sc.name)
            await self._enroll_phase(client, sc)
            results.extend(await self._test_phase(client, sc))
        return BatchResults(root=results)


async def main() -> None:
    parser = argparse.ArgumentParser(
        description="Tester script for voiceprint enrollment and verification."
    )
    parser.add_argument(
        "--recordings",
        required=True,
        type=Path,
        help="Recordings directory with .wav files named according to the convention",
    )
    parser.add_argument(
        "--server-url",
        type=str,
        help="Base URL of the server to test against",
        default="http://localhost:8000",
    )
    args = parser.parse_args()

    research = VoiceprintResearch(data=args.recordings)
    async with httpx.AsyncClient(base_url=args.server_url, timeout=60.0) as client:
        results = await research.run(client)
        results.summary()


if __name__ == "__main__":
    asyncio.run(main())
