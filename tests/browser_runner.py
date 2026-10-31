"""Run each browser flow against a fresh real model session."""
import argparse
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import time
from urllib.request import urlopen


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--model', choices=['mlp', 'cnn', 'transformer', 'rnn', 'lstm', 'gru'], default='transformer')
    parser.add_argument('--scripts', nargs='+', default=['phase2', 'checkpoint', 'ux'])
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    (root / 'docs').mkdir(exist_ok=True)
    if 'microscope' in args.scripts:
        subprocess.run([sys.executable, str(root / 'tests/generate_graph_fixtures.py')], check=True)
    for script in args.scripts:
        with socket.socket() as sock:
            sock.bind(('127.0.0.1', 0))
            port = sock.getsockname()[1]
        code = (
            'from p2i.examples import make_demo; from p2i import Harness; from p2i_gui import serve; '
            f'model,inputs=make_demo({args.model!r}); '
            f'serve(Harness(model,example_inputs=inputs),port={port})'
        )
        with tempfile.TemporaryFile(mode='w+') as log:
            server = subprocess.Popen([sys.executable, '-c', code], stdout=log, stderr=log)
            try:
                url = f'http://127.0.0.1:{port}'
                for _ in range(300):
                    if server.poll() is not None:
                        raise RuntimeError('Demo server stopped before becoming ready')
                    try:
                        with urlopen(url + '/api/harness', timeout=1) as response:
                            if response.status == 200:
                                break
                    except OSError:
                        time.sleep(0.2)
                else:
                    raise RuntimeError('Demo server did not become ready')
                subprocess.run(['node', f'tests/{script}.mjs'], cwd=root / 'frontend', check=True,
                               env={**os.environ, 'P2I_URL': url, 'P2I_DEMO': args.model}, timeout=180)
            except Exception:
                log.seek(0)
                print(log.read(), file=sys.stderr)
                raise
            finally:
                server.terminate()
                try:
                    server.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    server.kill()
                    server.wait()


if __name__ == '__main__':
    main()
