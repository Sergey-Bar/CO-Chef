import pytest

from app.scaling import (
    served_guests, total_portions, multiplier, apply_buffer, validate_segments,
    SCALING_SERVINGS, SCALING_PER_PERSON, SCALING_BATCH,
)


def test_served_guests_segment_and_global():
    assert served_guests(100, None) == 100
    assert served_guests(100, 30) == 30


def test_total_portions():
    assert total_portions(100, None, 2) == 200
    assert total_portions(100, 10, 1) == 10


def test_servings_multiplier():
    m = multiplier(100, None, 1, SCALING_SERVINGS, base_servings=25)
    assert m == pytest.approx(4.0)
    # segment 10, base 20 -> 0.5
    assert multiplier(100, 10, 1, SCALING_SERVINGS, base_servings=20) == pytest.approx(0.5)


def test_per_person_multiplier():
    assert multiplier(50, None, 1, SCALING_PER_PERSON) == 50
    assert multiplier(50, 5, 2, SCALING_PER_PERSON) == 10


def test_batch_multiplier_ceil():
    # 52 guests * 1 portion / 24 per batch -> 3 batches
    assert multiplier(52, None, 1, SCALING_BATCH, people_per_batch=24) == 3
    # exactly divisible -> 2
    assert multiplier(48, None, 1, SCALING_BATCH, people_per_batch=24) == 2


def test_batch_requires_people():
    with pytest.raises(ValueError):
        multiplier(10, None, 1, SCALING_BATCH)


def test_servings_requires_base():
    with pytest.raises(ValueError):
        multiplier(10, None, 1, SCALING_SERVINGS)


def test_apply_buffer():
    assert apply_buffer(100, 0) == 100
    assert apply_buffer(100, 10) == pytest.approx(110)
    assert apply_buffer(50, 5) == pytest.approx(52.5)


class _Seg:
    def __init__(self, count):
        self.guest_count = count


def test_validate_segments_ok():
    assert validate_segments(100, []) == []
    assert validate_segments(100, [_Seg(60), _Seg(40)]) == []


def test_validate_segments_mismatch():
    errs = validate_segments(100, [_Seg(60), _Seg(30)])
    assert len(errs) == 1
    assert "90" in errs[0]
