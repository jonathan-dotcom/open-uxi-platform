from internet_monitoring.pipeline.common.auth import constant_time_compare, extract_bearer


def test_extract_bearer_variants():
    assert extract_bearer("Bearer token123") == "token123"
    assert extract_bearer("token123") == "token123"
    assert extract_bearer("") == ""
    assert extract_bearer(None) == ""


def test_constant_time_compare():
    assert constant_time_compare("secret", "secret") is True
    assert constant_time_compare("secret", "SECRET") is False
    assert constant_time_compare("secret", None) is False
