
import threading
import time
import sys
import sysconfig

gil_disabled = sysconfig.get_config_var("Py_GIL_DISABLED")
print(f"GIL Disabled: {gil_disabled == 1}")
print(f"Python Version: {sys.version}\n")

def cpu_intensive_task(n, thread_id):
    """Compute prime numbers up to n"""
    start = time.perf_counter()
    primes = []
    for num in range(2, n):
        # verify = all(num % i != 0 for i in range(2, int(num ** 0.5) + 1))
        if all(num % i != 0 for i in range(2, int(num ** 0.5) + 1)):
            primes.append(num)
    elapsed = time.perf_counter() - start
    print(f"Thread {thread_id}: Found {len(primes)} primes in {elapsed:.3f}s")
    return primes

print("=" * 50)
print("Threaded Execution (4 threads)")
threads = []
start_threaded = time.perf_counter()

for i in range(4):
    t = threading.Thread(target=cpu_intensive_task, args=(10000, f"thread-{i}"))
    threads.append(t)
    t.start()

for t in threads:
    t.join()

threaded_time = time.perf_counter() - start_threaded
print(f"Total time: {threaded_time:.3f}s")
