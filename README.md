# mit_prod
### 1. Create the virtual env 
python3 -m venv .venv
### 2. Activate the virtual env
source .venv/bin/activate 
### 3. Install the dependencies
pip install -r requirements.txt
### 4. start the start.sh file
chmod +x start.sh
./start.sh
### 5. start the gemma server
chmod +x start_gemma.sh
./start_gemma.sh 0,2

Or select one GPU:
./start_gemma.sh 0