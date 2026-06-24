import os
from datetime import timedelta

_DEFAULT_SECRET = 'dev-secret-key'
_DEFAULT_JWT    = 'jwt-secret-key'

class Config:
    SECRET_KEY     = os.environ.get('SECRET_KEY', _DEFAULT_SECRET)
    _db_url = os.environ.get('DATABASE_URL', 'sqlite:///dealership.db')
    if _db_url.startswith('postgres') and 'sslmode' not in _db_url:
        _db_url += '?sslmode=require'
    SQLALCHEMY_DATABASE_URI = _db_url
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        'pool_pre_ping': True,
        'pool_recycle': 180,
        'pool_size': 5,
        'max_overflow': 5,
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
