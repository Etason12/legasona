import os
from datetime import timedelta

_DEFAULT_SECRET = 'dev-secret-key'
_DEFAULT_JWT    = 'jwt-secret-key'

class Config:
    SECRET_KEY     = os.environ.get('SECRET_KEY', _DEFAULT_SECRET)
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL', 'sqlite:///dealership.db')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        'pool_pre_ping': True,
        'pool_recycle': 300,
    }
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY', _DEFAULT_JWT)
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=8)
    DEBUG = os.environ.get('FLASK_ENV') == 'development'

    def __init__(self):
        if not self.DEBUG:
            if self.SECRET_KEY == _DEFAULT_SECRET:
                raise RuntimeError(
                    "SECRET_KEY must be set via environment variable in production. "
                    "Set FLASK_ENV=development to suppress this error during local dev."
                )
            if self.JWT_SECRET_KEY == _DEFAULT_JWT:
                raise RuntimeError(
                    "JWT_SECRET_KEY must be set via environment variable in production."
                )
