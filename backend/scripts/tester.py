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

    def get_verification_pool(self, duration: str) -> list[Path]:
        pool = [
            rec.file
            for rec in self.root
            if rec.metadata.duration == duration
            and rec.metadata.type in ("enrollment", "verification")
        ]
        return sorted(set(pool))

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
    probe: str
    scenario: str
    duration: str
    enrollments: int
    type: str
    score: float


class BatchResults(RootModel):
    root: list[ResearchResult]

    def summary(self, threshold: float = 0.7) -> None:
        if not self.root:
            logger.warning("No results to summarize")
            return

        grouped = defaultdict(list)
        for result in self.root:
            grouped[result.scenario].append(result)

        data = []
        logger.info("Summary of results (threshold: %.2f):", threshold)

        for scenario, results in sorted(grouped.items()):
            aut_scores = [r.score for r in results if r.type == "verification"]
            imp_scores = [r.score for r in results if r.type == "imposter"]
            sick_scores = [r.score for r in results if r.type == "sick"]
            spoof_scores = [r.score for r in results if r.type == "spoof"]

            data.append([f"SCENARIO: {scenario}", "", "", ""])

            frr = np.mean([s < threshold for s in aut_scores])
            avg_aut = np.mean(aut_scores)
            data.append(["  > verification", f"{avg_aut:.4f}", f"{frr:.1%}", "FRR"])

            far = np.mean([s >= threshold for s in imp_scores])
            avg_imp = np.mean(imp_scores)
            data.append(["  > imposter", f"{avg_imp:.4f}", f"{far:.1%}", "FAR"])

            sick_acc = np.mean([s >= threshold for s in sick_scores])
            avg_sick = np.mean(sick_scores)
            data.append(["  > sick", f"{avg_sick:.4f}", f"{sick_acc:.1%}", "SICK ACCEPT RATE"])

            spoof_acc = np.mean([s >= threshold for s in spoof_scores])
            avg_spoof = np.mean(spoof_scores)
            data.append(
                ["  > spoofing", f"{avg_spoof:.4f}", f"{spoof_acc:.1%}", "SPOOFING ACCEPT RATE"]
            )

        output = tabulate(
            data,
            headers=["SCENARIO / TEST TYPE", "AVG SCORE", "RATE [%]", "METRIC DESC"],
            tablefmt="fancy_grid",
            colalign=("left", "right", "right"),
        )
        logger.info("\n%s", output)
        logger.info("Total tests performed: %d", len(self.root))
        self._similarity_matrix()
        self._imposter_stats_matrix()

    def _similarity_matrix(self) -> None:
        logger.info("Similarity matrix (cross-score analysis):")
        scenarios = {r.scenario for r in self.root}
        for sc in sorted(scenarios):
            results = [
                r for r in self.root if r.scenario == sc and r.type in ("verification", "imposter")
            ]

            targets = sorted({r.user for r in results})
            probes = sorted({r.probe.split("_")[0] for r in results})
            tidx = {name: i for i, name in enumerate(targets)}
            pidx = {name: i for i, name in enumerate(probes)}

            n_rows, n_cols = len(targets), len(probes)
            matrix_sums = np.zeros((n_rows, n_cols))
            matrix_counts = np.zeros((n_rows, n_cols))
            for result in results:
                ridx = tidx[result.user]
                cidx = pidx[result.probe.split("_")[0]]
                matrix_sums[ridx, cidx] += result.score
                matrix_counts[ridx, cidx] += 1

            matrix_avgs = np.divide(
                matrix_sums, matrix_counts, out=np.zeros_like(matrix_sums), where=matrix_counts != 0
            )
            data = []
            for i, target in enumerate(targets):
                row = [target.upper()]
                for j in range(n_cols):
                    value = f"{matrix_avgs[i, j]:.4f}" if matrix_counts[i, j] > 0 else "-"
                    row.append(value)
                data.append(row)

            headers = ["TARGET / INPUT"] + [p.upper() for p in probes]
            output = tabulate(data, headers=headers, tablefmt="fancy_grid")
            logger.info("\n%s", output)
            logger.info("Total comparisons: %d", len(results))

    def _imposter_stats_matrix(self) -> None:
        logger.info("Imposter min/max matrix (score range analysis):")
        scenarios = {r.scenario for r in self.root}
        for sc in scenarios:
            results = [r for r in self.root if r.scenario == sc and r.type == "imposter"]

            targets = sorted({r.user for r in results})
            probes = sorted({r.probe.split("_")[0] for r in results})

            mapping = defaultdict(lambda: defaultdict(list))
            for result in results:
                probe = result.probe.split("_")[0]
                mapping[result.user][probe].append(result.score)

            data = []
            for target in targets:
                row = [target.upper()]
                for probe in probes:
                    if target == probe:
                        row.append("-")
                        continue
                    scores = mapping[target][probe]
                    row.append(f"{min(scores):.4f} / {max(scores):.4f}")
                data.append(row)

            headers = ["TARGET / INPUT (MIN/MAX)"] + [p.upper() for p in probes]
            output = tabulate(data, headers=headers, tablefmt="fancy_grid")
            logger.info("\n%s", output)
            logger.info("Total comparisons: %d", len(results))


class VoiceprintResearch:
    _SCENARIOS: list[Scenario] = [
        Scenario(name="S1_LONG_5", duration="long", enrollments=5),
        Scenario(name="S1_SHORT_5", duration="short", enrollments=5),
        Scenario(name="S3_LONG_3", duration="long", enrollments=3),
    ]
    _ENR_ENDPOINT: str = "/api/v1/private/enroll"
    _VER_ENDPOINT: str = "/api/v1/private/verify"
    _STATIC_TESTS: tuple[str, ...] = ("spoof", "sick")

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

    async def _run_dynamic_verification(
        self,
        client: httpx.AsyncClient,
        scenario: Scenario,
        user: UserGroup,
        uid: str,
        files: list[Path],
    ) -> list[ResearchResult]:
        results = []
        for file in files:
            score = await self._get_score(client, uid, file)
            results.append(
                ResearchResult(
                    user=user.username,
                    probe=f"{user.username}_verification",
                    scenario=scenario.name,
                    duration=scenario.duration,
                    enrollments=scenario.enrollments,
                    type="verification",
                    score=score,
                )
            )
        return results

    async def _run_static_tests(
        self, client: httpx.AsyncClient, scenario: Scenario, user: UserGroup, uid: str
    ) -> list[ResearchResult]:
        results = []
        for ttype in self._STATIC_TESTS:
            files = user.recordings.filter(duration=scenario.duration, type=ttype)
            for file in files:
                score = await self._get_score(client, uid, file)
                results.append(
                    ResearchResult(
                        user=user.username,
                        probe=f"{user.username}_{ttype}",
                        scenario=scenario.name,
                        duration=scenario.duration,
                        enrollments=scenario.enrollments,
                        type=ttype,
                        score=score,
                    )
                )
        return results

    async def _run_imposter_tests(
        self, client: httpx.AsyncClient, scenario: Scenario, user: UserGroup, uid: str
    ) -> list[ResearchResult]:
        results = []
        others = [u for u in self._users if u.username != user.username]
        for imposter in others:
            files = imposter.recordings.get_verification_pool(scenario.duration)
            for file in files:
                score = await self._get_score(client, uid, file)
                results.append(
                    ResearchResult(
                        user=user.username,
                        probe=f"{imposter.username}_imposter",
                        scenario=scenario.name,
                        duration=scenario.duration,
                        enrollments=scenario.enrollments,
                        type="imposter",
                        score=score,
                    )
                )
        return results

    async def run(self, client: httpx.AsyncClient) -> BatchResults:
        results = []
        for sc in self._SCENARIOS:
            logger.info(
                "> SCENARIO: %s (duration: %s, enrollments: %d)",
                sc.name,
                sc.duration,
                sc.enrollments,
            )
            for user in self._users:
                pool = user.recordings.get_verification_pool(sc.duration)
                available = len(pool)
                logger.info("Running rotation (for user: %s) on %d files", user.username, available)

                for i in range(available):
                    indices = [(i + j) % available for j in range(sc.enrollments)]
                    uid = f"{user.id}_{sc.name}_fold{i}".replace("-", "")

                    await self._enroll_user(client, uid, [pool[idx] for idx in indices])
                    await asyncio.sleep(0.5)

                    verfiles = [pool[idx] for idx in range(available) if idx not in indices]
                    if verfiles:
                        results.extend(
                            await self._run_dynamic_verification(client, sc, user, uid, verfiles)
                        )
                    results.extend(await self._run_static_tests(client, sc, user, uid))
                    results.extend(await self._run_imposter_tests(client, sc, user, uid))
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
    parser.add_argument(
        "--threshold",
        type=float,
        help="Verification threshold for acceptance",
        default=0.7,
    )
    args = parser.parse_args()

    research = VoiceprintResearch(data=args.recordings)
    async with httpx.AsyncClient(base_url=args.server_url, timeout=60.0) as client:
        results = await research.run(client)
        results.summary(args.threshold)


if __name__ == "__main__":
    asyncio.run(main())
