# %%
import sqlite3
from langchain.embeddings import LlamaCppEmbeddings
from langchain.schema.document import Document
from langchain.text_splitter import CharacterTextSplitter
from langchain.vectorstores import Chroma
from langchain.chains import RetrievalQA
from langchain.embeddings import LlamaCppEmbeddings
from langchain.llms import LlamaCpp
from langchain.callbacks.manager import CallbackManager
from langchain.callbacks.streaming_stdout import StreamingStdOutCallbackHandler
from langchain.prompts import PromptTemplate

from inscriptis import get_text
# %%
con = sqlite3.connect("./gitabase_texts_eng.db")
cur = con.cursor()
#%%
res = cur.execute("""
    SELECT _id,ch_no,txt_no,transl2,comment,book_id
    FROM textindex
    WHERE book_id = '1'
""")
# res = cur.execute("""
#     SELECT textnums._id, textnums.ch_no,textnums.txt_no,textnums.preview,texts.comment,textnums.book_id
#     FROM textnums
#     INNER JOIN texts
#     ON textnums.preview = texts.transl2
#     WHERE textnums.book_id = '1'
# """)
texts = res.fetchall()
#%%
print(texts[1], len(texts))
docs = [Document(page_content=f"Bhagavad Gita Chapter {t[1]}, Verse {t[2]}: \"{t[3]}\"\n Srila Prabhupada comment for BG {t[1]}.{t[2]}: \"{get_text(t[4]).strip()}\"", metadata={"chapter": t[1], "verse": t[2], "book": t[5] }) for t in texts]
print(docs[1], len(docs))
for doc in docs:
    print(doc.page_content[:300])
    print('=====')
# %%
text_splitter = CharacterTextSplitter(chunk_size=1000, chunk_overlap=0)
chunks = text_splitter.split_documents(docs)
model_version = 7
embeddings = LlamaCppEmbeddings(model_path=f"./llama-2-{model_version}b-chat.Q5_K_M.gguf", n_gpu_layers=1, n_batch=1024, f16_kv=True, n_ctx=4096)
persist_directory = 'pbvect'
# docsearch = Chroma.from_documents(documents=chunks, embedding=embeddings, persist_directory=persist_directory)
# docsearch.persist()
docsearch = Chroma(persist_directory=persist_directory, embedding_function=embeddings)
# %%
query = "Who is Krishna?"
res_docs = docsearch.similarity_search(query)
# for doc in docs[:10]:
#     print(doc.page_content)
print('Results:')
for doc in res_docs[:5]:
    print(doc.page_content[:200])
    print('=====')

# %%
prompt_template = """[INST] <<SYS>>
You are a genius vedic scriptures scolar and disciple of Srila Prabhupada
<</SYS>>
Use the following pieces of context to answer the question at the end.

{context}

Question: {question}
Answer based on provided context: [/INST]"""
PROMPT = PromptTemplate(
    template=prompt_template, input_variables=["context", "question"]
)
chain_type_kwargs = {"prompt": PROMPT}
callback_manager = CallbackManager([StreamingStdOutCallbackHandler()])
llm = LlamaCpp(model_path=f"./llama-2-{model_version}b-chat.Q5_K_M.gguf", n_gpu_layers=1, n_batch=1024, f16_kv=True, verbose=True, callback_manager=callback_manager, n_ctx=4096, max_tokens=4096)
qa = RetrievalQA.from_chain_type(llm=llm, chain_type="stuff", retriever=docsearch.as_retriever(), chain_type_kwargs=chain_type_kwargs, return_source_documents=True)
# %%
# query = "What is Srila Prabhupada purpose to present this Bhagavad-gītā As It Is?"
# query = "Who is Krishna?"
# query = "Summarize BG 1.1 please"
query = 'What is the essence of Gita?'
# query = 'Can I drink beer?'
# query = 'I am an atheist. I dont believe in God.'
result = qa({"query": query})
# print(result["result"])
# print(result["source_documents"])
for doc in result["source_documents"][:3]:
    print(doc.page_content[:500])
    print('=====')
# %%
