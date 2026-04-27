"""Risk model - top-3 risks surfaced by an analysis."""
from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, ForeignKey, SmallInteger, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.analysis import Analysis


class Risk(Base):
    """One of the top-3 plain-language risks for an analysis."""

    __tablename__ = "risks"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    analysis_id: Mapped[int] = mapped_column(
        ForeignKey("analyses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    rank: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    plain_language_description: Mapped[str] = mapped_column(Text, nullable=False)

    analysis: Mapped["Analysis"] = relationship(back_populates="risks")

    __table_args__ = (
        UniqueConstraint("analysis_id", "rank", name="uq_risks_analysis_rank"),
        CheckConstraint("rank BETWEEN 1 AND 3", name="ck_risks_rank_range"),
    )
