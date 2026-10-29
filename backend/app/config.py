# now this is the file which will read the environment variables from the .env file and store them in a class called Settings. 
# This class will be used to access the environment variables throughout the application.

from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    database_hostname: str 
    database_port: int  
    database_password: str
    database_name: str
    database_username: str
    
    model_config = SettingsConfigDict(env_file=".env")
        
settings = Settings()