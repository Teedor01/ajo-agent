"""
Loading .env here, at the package's own __init__, means it's read exactly
once, automatically, the first time anything imports from `app` -- whether
that's app.seed, app.agent.agent, or a future FastAPI entrypoint. No script
has to remember to call load_dotenv() itself.
"""
from dotenv import load_dotenv

load_dotenv()
