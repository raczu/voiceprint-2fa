from pydantic import BaseModel


class VerifyResponse(BaseModel):
    success: bool
    score: float
    threshold: float
