from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.chat import router as chat_router
from app.api.routes.insights import router as insights_router
from app.api.routes.metrics import router as metrics_router
from app.api.routes.upload_analysis import router as upload_analysis_router

app = FastAPI(title="QMetrix AI Service", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5000",
        "http://127.0.0.1:5000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat_router, prefix="/api/v1/ai", tags=["chat"])
app.include_router(insights_router, prefix="/api/v1/ai", tags=["insights"])
app.include_router(metrics_router, prefix="/api/v1/ai", tags=["metrics"])
app.include_router(upload_analysis_router, prefix="/api/v1/ai", tags=["upload-analysis"])


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "qmetrix-ai"}
