# ponytail: minimal runnable check — fails if the component wrapper or example app breaks.
from streamlit.testing.v1 import AppTest

at = AppTest.from_file("example_app.py").run()
assert not at.exception, at.exception
assert at.title[0].value.startswith("Fancy UI Grid"), at.title[0].value
assert at.json[0].value == "[]", at.json[0].value  # default: no selected ids
print("AppTest OK - script ran, component returned default value")
