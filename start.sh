#!/bin/bash
cd "$(dirname "$0")"
source .venv/bin/activate

python config/manage.py makemigrations
python config/manage.py migrate
python manage.py runserver 127.0.0.1:8002