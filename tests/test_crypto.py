"""Unit tests for the Fernet encryption helper."""
from app.services.crypto import decrypt, encrypt


def test_roundtrip():
    plaintext = "super-secret-token-abc123"
    assert decrypt(encrypt(plaintext)) == plaintext


def test_different_ciphertexts():
    """Each encrypt call produces a unique ciphertext (Fernet uses random IV)."""
    token = "same-token"
    assert encrypt(token) != encrypt(token)


def test_empty_string():
    assert decrypt(encrypt("")) == ""


def test_unicode():
    value = "tëst-üñícode-🔑"
    assert decrypt(encrypt(value)) == value
