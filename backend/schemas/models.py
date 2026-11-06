from pydantic import BaseModel, Field
from typing import Optional, List


class DatasetResult(BaseModel):
    id: str
    description: str
    downloads: int
    likes: int
    tags: List[str]
    source: str = "huggingface"


class DatasetColumn(BaseModel):
    name: str
    type: str


class TrainingConfig(BaseModel):
    dataset_id: str
    text_column: str
    label_column: str
    model_name: str
    num_epochs: int = Field(ge=1, le=20)
    batch_size: int = Field(ge=4, le=64)
    learning_rate: float = Field(ge=1e-7, le=1e-3)
    test_size: float = Field(ge=0.05, le=0.4)
    max_samples: int = Field(default=10000, ge=100, le=50000)
    preset: str
    task_type: str = "text"
    config_name: Optional[str] = None


class KaggleCredentials(BaseModel):
    username: str
    api_key: str


class JobStatusResponse(BaseModel):
    job_id: str
    status: str
    progress: int
    message: str
    results: Optional[dict] = None
    download_url: Optional[str] = None
