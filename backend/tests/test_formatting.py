from app.formatting import fraction_str, format_quantity, is_count_like


def test_fraction_str():
    assert fraction_str(0) == "0"
    assert fraction_str(1) == "1"
    assert fraction_str(2.5) == "2 1/2"
    assert fraction_str(0.25) == "1/4"
    assert fraction_str(0.333) == "1/3"
    assert fraction_str(1.125) == "1 1/8"
    assert fraction_str(0.75) == "3/4"
    assert fraction_str(3.875) == "3 7/8"


def test_count_round_up_flag():
    r = format_quantity(5.3, "egg")
    assert r["text"] == "6"
    assert r["rounded_up"] is True
    r2 = format_quantity(5.0, "egg")
    assert r2["text"] == "5"
    assert r2["rounded_up"] is False


def test_volume_fraction_no_roundup():
    r = format_quantity(1.5, "cup")
    assert r["text"] == "1 1/2"
    assert r["rounded_up"] is False


def test_is_count_like():
    assert is_count_like("each")
    assert is_count_like("packages")
    assert not is_count_like("g")
    assert not is_count_like(None)
