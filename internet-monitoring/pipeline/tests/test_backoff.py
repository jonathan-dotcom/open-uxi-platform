from internet_monitoring.pipeline.common.backoff import ExponentialBackoff


def test_backoff_grows_until_max():
    backoff = ExponentialBackoff(base=0.1, factor=2.0, max_interval=1.0, jitter=0.0)
    intervals = [backoff.next_interval() for _ in range(5)]
    assert intervals[0] == 0.1
    assert intervals[1] == 0.2
    assert all(x <= y for x, y in zip(intervals, intervals[1:]))
    assert intervals[-1] == backoff.max_interval
    assert backoff.next_interval() == backoff.max_interval
    backoff.reset()
    assert backoff.next_interval() == 0.1
