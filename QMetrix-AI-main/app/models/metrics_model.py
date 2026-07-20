from typing import Any, Literal

from pydantic import BaseModel, Field


MetricHealth = Literal["healthy", "watch", "at_risk", "critical", "unknown"]
MetricValidationSeverity = Literal["warning", "error"]


class OCRMetricInput(BaseModel):
    label: str = Field(description="OCR extracted label or metric name")
    value: str | int | float | None = Field(
        default=None,
        description="OCR extracted value associated with the label",
    )
    confidence: float | None = Field(
        default=None,
        description="Optional OCR confidence score between 0 and 1",
    )


class MetricsExtractionRequest(BaseModel):
    dashboard_data: dict[str, Any] = Field(
        default_factory=dict,
        description="Structured dashboard values passed by the caller",
    )
    ocr_outputs: list[OCRMetricInput] = Field(
        default_factory=list,
        description="OCR extracted metric candidates from dashboard screenshots",
    )


class MetricValidationIssue(BaseModel):
    field: str
    severity: MetricValidationSeverity
    message: str
    provided_value: Any | None = None


class StandardizedMetric(BaseModel):
    key: str
    label: str
    value: float | str | None
    unit: str | None = None
    normalized_value: float | None = None
    health: MetricHealth = "unknown"
    source_fields: list[str] = Field(default_factory=list)


class MetricsExtractionResponse(BaseModel):
    success: bool
    message: str
    metrics: list[StandardizedMetric]
    normalized_context: dict[str, float]
    validation_issues: list[MetricValidationIssue]

