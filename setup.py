"""
Setup configuration for Month-End Close backend
This allows the backend package to be installed in editable mode for testing
"""

from setuptools import setup, find_packages

setup(
    name="monthend-backend",
    version="1.0.0",
    packages=find_packages(),
    python_requires=">=3.11",
    install_requires=[
        # Dependencies are managed in requirements.txt
    ],
)

