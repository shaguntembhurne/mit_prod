#!/bin/bash
cd "$(dirname "$0")"
source .venv/bin/activate

python config/manage.py makemigrations
python config/manage.py migrate
python config/manage.py runserver