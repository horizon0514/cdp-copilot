import { take_snapshot } from './snapshotTools';
import { click, hover, fill, fill_form, type_text, press_key } from './actionTools';
import { navigate_page, new_page, list_pages, select_page, close_page, wait_for } from './navigationTools';
import { evaluate_script } from './evaluateTool';
import { take_screenshot } from './screenshotTool';
import { list_console_messages, get_console_message } from './consoleTools';
import { list_network_requests, get_network_request } from './networkTools';

export const tools = {
  take_snapshot,
  click,
  hover,
  fill,
  fill_form,
  type_text,
  press_key,
  navigate_page,
  new_page,
  list_pages,
  select_page,
  close_page,
  wait_for,
  evaluate_script,
  take_screenshot,
  list_console_messages,
  get_console_message,
  list_network_requests,
  get_network_request,
};
