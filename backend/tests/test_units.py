import pytest

from app.units import convert_quantity


def test_same_unit_identity():
    r = convert_quantity(2, "cup", "cup")
    assert r.ok and r.value == 2


def test_volume_same_dimension():
    r = convert_quantity(1, "cup", "tbsp")
    assert r.ok
    assert r.value == pytest.approx(16, abs=0.1)


def test_weight_same_dimension():
    r = convert_quantity(16, "oz", "lb")
    assert r.ok and r.value == pytest.approx(1)


def test_weight_kg_g():
    r = convert_quantity(2, "kg", "g")
    assert r.ok and r.value == 2000


def test_volume_to_weight_with_density():
    # 2 cups flour, density 0.529 g/mL -> 2*236.588*0.529 g = 250.3 g
    r = convert_quantity(2, "cup", "g", density=0.529)
    assert r.ok
    assert r.value == pytest.approx(250.31, abs=0.5)
    assert not r.needs_density


def test_volume_to_weight_missing_density_flags():
    r = convert_quantity(2, "cup", "g", density=None)
    assert not r.ok
    assert r.needs_density
    assert r.error


def test_weight_to_volume_with_density():
    # 100 g oil at density 0.92 -> 108.7 mL
    r = convert_quantity(100, "g", "ml", density=0.92)
    assert r.ok
    assert r.value == pytest.approx(108.696, abs=0.1)


def test_unknown_unit_flags():
    r = convert_quantity(2, "furlong", "g")
    assert not r.ok
    assert r.error
    r2 = convert_quantity(2, "g", "furlong")
    assert not r2.ok


def test_count_unit_no_conversion():
    r = convert_quantity(3, "egg", "egg")
    assert r.ok and r.value == 3
