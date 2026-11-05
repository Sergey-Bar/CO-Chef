import pytest

from app.costs import line_cost, event_cost_totals


def test_line_cost_aligned_units():
    # 2 lbs of chicken at $4/lb -> $8
    cost, ok, err = line_cost(2, "lb", "lb", 4.0)
    assert ok and cost == pytest.approx(8)


def test_line_cost_cross_dimension_with_density():
    # 1 cup olive oil (density 0.92) converted to g at $0.011/g
    # 236.588 mL * 0.92 = 217.66 g * 0.011 = $2.394
    cost, ok, err = line_cost(1, "cup", "g", 0.011, density=0.92)
    assert ok
    assert cost == pytest.approx(2.394, abs=0.01)


def test_line_cost_missing_cost_flags():
    cost, ok, err = line_cost(1, "cup", "cup", None)
    assert not ok and "No cost" in err


def test_line_cost_missing_conversion_flags():
    cost, ok, err = line_cost(1, "cup", "g", 1.0, density=None)
    assert not ok and "density" in err.lower()


def test_event_cost_totals():
    totals = event_cost_totals(100.0, other_costs=50.0, tax_percent=10.0)
    assert totals["ingredient_subtotal"] == 100.0
    assert totals["other_costs"] == 50.0
    assert totals["tax"] == pytest.approx(10.0)
    assert totals["total"] == pytest.approx(160.0)


def test_event_cost_totals_no_tax():
    totals = event_cost_totals(80.0, other_costs=20.0, tax_percent=0)
    assert totals["total"] == pytest.approx(100.0)
