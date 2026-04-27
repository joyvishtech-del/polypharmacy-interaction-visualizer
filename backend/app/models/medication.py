"""Medication model."""
from __future__ import annotations

import enum
from datetime import date
from typing import TYPE_CHECKING

from sqlalchemy import Date, Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.analysis import Analysis
    from app.models.user import User


class MedicationSource(str, enum.Enum):
    """How a medication was added to the system."""

    manual = "manual"
    ocr = "ocr"


class Medication(Base, TimestampMixin):
    """A medication record belonging to a user."""

    __tablename__ = "medications"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    dosage: Mapped[str] = mapped_column(String(100), nullable=False)
    frequency: Mapped[str] = mapped_column(String(100), nullable=False)
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    source: Mapped[MedicationSource] = mapped_column(
        Enum(MedicationSource, name="medication_source"),
        default=MedicationSource.manual,
        server_default=MedicationSource.manual.value,
        nullable=False,
    )
    photo_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    ocr_raw_text: Mapped[str | None] = mapped_column(Text, nullable=True)

    user: Mapped["User"] = relationship(back_populates="medications")
    analyses: Mapped[list["Analysis"]] = relationship(
        secondary="analysis_medications",
        back_populates="medications",
    )
