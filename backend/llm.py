import os
from langchain_openai import ChatOpenAI
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.runnables.history import RunnableWithMessageHistory
from langchain_openai import OpenAI
from langchain_mongodb.chat_message_histories import MongoDBChatMessageHistory
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.runnables.history import RunnableWithMessageHistory
from langchain_openai import ChatOpenAI
import os
import ast

os.environ["SERPAPI_API_KEY"] = "6cdae9e7d9a0a496d959ce02d732a0202ee47d1d4b134dfab286b4812f726078"
os.environ["OPENAI_API_KEY"] = "OPENAI_API_KEY"
# Initialize LLM
OPENAI_API_KEY="lm-studio"

embeddings = HuggingFaceEmbeddings()

# Initialize DeepLake vector store

prompt = ChatPromptTemplate.from_messages(
    [
        ("system", "You are a helpful assistant."),
        MessagesPlaceholder(variable_name="history"),
        ("human", "{question}"),
    ]
)

chain = prompt | ChatOpenAI(base_url="http://localhost:1234/v1", api_key=OPENAI_API_KEY, temperature=0)
chain_with_history = RunnableWithMessageHistory(
    chain,
    lambda session_id: MongoDBChatMessageHistory(
        session_id=session_id,
        connection_string="mongodb+srv://weslagarde:Beaubeau2023!@cluster0.zpowdpt.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0",
        database_name="mr_gadgets_memory",
        collection_name="chat_histories",
    ),
    input_messages_key="question",
    history_messages_key="history",
)


async def query_llm(text: str, session_id: str):
    try:
        # Initialize OpenAI API client
        config = {"configurable": {"session_id": session_id}}

        # Run the agent with the user's input
        response = chain_with_history.invoke({"question": text}, config=config)
        # Extract and return the content field from the AI response
        return response

    except Exception as e:
        print(f"Error occurred: {e}")
        return "An error occurred while querying the language model."

# Example usage
if __name__ == "__main__":
    import asyncio
    response = asyncio.run(query_llm(text="Then how did you remember my dog's name and my age?", session_id="0001"))
    content = response.content
    print(content)
