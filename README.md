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

## Model Concurrency Test

Tested Gemma 4 12B using `llama.cpp` on 2 NVIDIA Tesla T4 GPUs.

- **Concurrent requests:** 20
- **Successful requests:** 20/20
- **Failed requests:** 0
- **Total test time:** 27.02 seconds
- **Average response time:** 17.69 seconds
- **95th percentile response time:** 26.99 seconds
- **Requests per second:** 0.74

### Test Details

20 requests were sent simultaneously to the model API. All requests completed successfully.

This was a **raw model API test**, without the MCP server or Django backend in the request flow. The results measure model-serving performance only, not the performance of the complete application.

*Note: Results are from a single test run. Actual performance may vary depending on prompt length, response length, and server load.*
