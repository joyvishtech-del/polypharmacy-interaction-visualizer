"""InteractionEdge model - represents a drug-drug interaction edge in the graph."""
from __future__ import annotations

import enum
from typing import TYPE_CHECKING

from sqlalchemy import Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.analysis import Analysis


class Severity(str, enum.Enum):
    """Interaction severity (traffic-light)."""

    red = "red"
    yellow = "yellow"
    green = "green"


class InteractionEdge(Base):
    """An edge between two drugs in an analysis interaction graph."""

    __tablename__ = "interaction_edges"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    analysis_id: Mapped[int] = mapped_column(
        ForeignKey("analyses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    drug_a: Mapped[str] = mapped_column(String(200), nullable=False)
    drug_b: Mapped[str] = mapped_column(String(200), nullable=False)
    severity: Mapped[Severity] = mapped_column(
        Enum(Severity, name="severity"),
        nullable=False,
    )
    explanation: Mapped[str] = mapped_column(Text, nullable=False)

    analysis: Mapped["Analysis"] = relationship(back_populates="edges")
