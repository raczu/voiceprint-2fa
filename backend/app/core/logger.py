LOGGING_CONFIG = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "simple": {"format": "[%(asctime)s] %(levelname)s: %(message)s", "datefmt": "%H:%M:%S"},
        "detailed": {
            "format": "[%(asctime)s | %(module)s] %(levelname)s: %(message)s",
            "datefmt": "%H:%M:%S",
        },
    },
    "handlers": {
        "stdout": {
            "class": "logging.StreamHandler",
            "level": "INFO",
            "formatter": "simple",
            "stream": "ext://sys.stdout",
        },
    },
    "loggers": {"root": {"level": "INFO", "handlers": ["stdout"]}},
}
