FROM python:3.12-slim

RUN apt-get update && apt-get install -y libpq-dev && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ backend/
COPY css/ css/
COPY js/ js/
COPY *.html .
COPY robots.txt sitemap.xml CNAME ./

WORKDIR /app/backend

CMD ["python", "main.py"]
