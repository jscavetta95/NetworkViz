import sys
from cx_Freeze import setup, Executable

base = None
if sys.platform == 'win32':
    base = 'Win32GUI'

executables = [
    Executable('network_viz.py', base=base)
]

include_files = ['app/templates', 'app/static']
includes = ['jinja2.ext']
excludes = []

setup(name='NetworkViz',
      version='0.1',
      description='NetworkViz',
      author='Joseph Scavetta',
      author_email='jscavetta95@gmail.com',
      options={'build_exe': {'excludes': excludes, 'include_files': include_files, 'includes': includes}},
      executables=executables)
