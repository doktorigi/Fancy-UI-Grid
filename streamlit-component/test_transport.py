import unittest
from unittest.mock import patch
import fancy_ui_grid as grid


class Rerun(Exception):
    pass


class TransportTests(unittest.TestCase):
    def test_requests_are_answered_on_rerun_and_batch_callback_is_not_replayed(self):
        state = {}
        payload = {"selected_ids": [], "edits": [], "server_requests": [{"id": "request-1", "request": {"startRow": 0, "endRow": 1}}],
                   "batch_request": {"id": "save-1", "edits": [{"rowId": 1, "field": "amount", "oldValue": 1, "value": 2}]}}
        calls = []
        def save(edits):
            calls.append(edits)
            return {"errors": [{"rowId": 1, "field": "amount", "message": "Rejected by server"}]}
        with patch('streamlit.session_state', state), patch('streamlit.rerun', side_effect=Rerun), patch.object(grid, '_component_func', return_value=payload) as component:
            with self.assertRaises(Rerun):
                grid.fancy_ui_grid([], [], data_source=lambda request: {"rows": [], "rowCount": 0}, on_batch_save=save, key="test")
            result = grid.fancy_ui_grid([], [], data_source=lambda request: self.fail("Datasource request replayed"), on_batch_save=save, key="test")
            self.assertIs(result, payload)
            self.assertEqual(len(calls), 1)
            args = component.call_args.kwargs
            self.assertEqual(args["server_responses"][0]["id"], "request-1")
            self.assertEqual(args["batch_response"]["result"]["errors"][0]["message"], "Rejected by server")

    def test_errors_become_responses_and_managed_instances_require_keys(self):
        with self.assertRaises(ValueError):
            grid.fancy_ui_grid([], [], data_source=lambda request: {})
        with patch('streamlit.session_state', {}), patch('streamlit.rerun', side_effect=Rerun), patch.object(grid, '_component_func', return_value={"server_requests": [{"id": "x", "request": {}}]}):
            with self.assertRaises(Rerun):
                grid.fancy_ui_grid([], [], data_source=lambda request: (_ for _ in ()).throw(ValueError("Unavailable")), key="test")


if __name__ == '__main__':
    unittest.main()
