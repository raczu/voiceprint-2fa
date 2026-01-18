import asyncio
import logging

from sqlalchemy import select

from app.database.conn import AsyncSessionLocal
from app.database.models import Phrase

logger = logging.getLogger(__name__)

PHRASES_CONTENT = [
    "Błędy też się dla mnie liczą. Nie wykreślam ich ani z życia, ani z pamięci. I nigdy nie winię za nie innych.",
    "Każda porażka jest dla mnie lekcją, której nie da się kupić. Buduje mój charakter i pozwala iść dalej z podniesioną głową.",
    "Moje decyzje należą tylko do mnie. Niezależnie od wyniku, akceptuję ich wszystkie konsekwencje bez zrzucania winy na otoczenie.",
    "Szacunek zdobywa się postawą, a nie pustymi słowami. Dlatego staram się żyć tak, by nigdy nie wstydzić się własnego odbicia w lustrze.",
    "Nie oglądam się za siebie z żalem. To, co było wczoraj, ukształtowało mnie dzisiaj. Patrzę w przyszłość spokojnie i pewnie.",
    "Prawda jest dla mnie najważniejszą wartością. Nie muszę niczego udawać, bo moja tożsamość jest spójna z tym, co mówię.",
    "Mój głos jest unikalnym kluczem do mojej tożsamości. Każde wypowiedziane słowo potwierdza, że jestem osobą, za którą się podaję.",
]


async def init() -> None:
    async with AsyncSessionLocal() as session:
        try:
            result = await session.execute(select(Phrase).limit(1))
            first = result.scalar_one_or_none()
            if first is not None:
                logger.info("Phrases already initialized, skipping...")
                return

            logger.info("Initializing phrases...")
            for content in PHRASES_CONTENT:
                phrase = Phrase(content=content)
                session.add(phrase)

            await session.commit()
            logger.info("Phrases initialized. Added %d phrases.", len(PHRASES_CONTENT))
        except Exception as exc:
            logger.error("Failed to initialize phrases: %s", exc)


def main() -> None:
    asyncio.run(init())


if __name__ == "__main__":
    main()
