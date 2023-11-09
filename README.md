# prabhupadai
RAG over Prabhupad books

SQLite db files with all Srila Prabhupad books:
https://gitabase.com/gitabase_details.php?gb=texts_eng
https://gitabase.com/gitabase_details.php?gb=texts_rus

App to inspect SQLite compatible db files in nice GUI:
https://sqlitebrowser.org/

Llama 2 files for llama cpp:
https://huggingface.co/TheBloke/Llama-2-7B-Chat-GGUF
https://huggingface.co/TheBloke/Llama-2-13B-Chat-GGUF

To run:
0. Install Anaconda python distribution, miniconda is ok
1. Install missing packages, langchain, etc. (TODO: create file with dependencies)
2. Download sql db file with SP books
3. Download llama cpp gguf file

Next steps:
 - Experiment with more books indexed in Chroma, bigger llama models and prompts
 - Experiment with OpenAI GPT-4
 - Build web version