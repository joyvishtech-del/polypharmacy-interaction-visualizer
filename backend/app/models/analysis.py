"""Analysis model and Analysis<->Medication join table."""
from __future__ import annotations

import enum
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.doctor_question import DoctorQuestion
    from app.models.interaction_edge import InteractionEdge
    from app.models.medication import Medication
    from app.models.risk import Risk
    from app.models.user import User


class AnalysisStatus(str, enum.Enum):
    """Lifecycle status of an Analysis run."""

    pending = "pending"
    completed = "completed"
    failed = "failed"


class Analysis(Base):
    """A single LLM-driven interaction analysis run for a user."""

    __tablename__ = "analyses"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    summary: Mapped[str] = mapped_column(Text, nullable=False, default="")
    status: Mapped[AnalysisStatus] = mapped_column(
        Enum(AnalysisStatus, name="analysis_status"),
        default=AnalysisStatus.pending,
        server_default=AnalysisStatus.pending.value,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    user: Mapped["User"] = relationship(back_populates="analyses")
    medications: Mapped[list["Medication"]] = relationship(
        secondary="analysis_medications",
        back_populates="analyses",
    )
    edges: Mapped[list["InteractionEdge"]] = relationship(
        back_populates="analysis",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    risks: Mapped[list["Risk"]] = relationship(
        back_populates="analysis",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="Risk.rank",
    )
    doctor_questions: Mapped[list["DoctorQuestion"]] = relationship(
        back_populates="analysis",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="DoctorQuestion.position",
    )


class AnalysisMedication(Base):
    """Composite-PK join table linking analyses to medications."""

    __tablename__ = "analysis_medications"

    analysis_id: Mapped[int] = mapped_column(
        ForeignKey("analyses.id", ondelete="CASCADE"),
        primary_key=True,
    )
    medication_id: Mapped[int] = mapped_column(
        ForeignKey("medications.id", ondelete="CASCADE"),
        primary_key=True,
    )
