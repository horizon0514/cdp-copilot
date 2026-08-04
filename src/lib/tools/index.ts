import { take_snapshot } from './snapshotTools';
import { click, hover, fill, fill_form, type_text, press_key } from './actionTools';
import { navigate_page, new_page, list_pages, select_page, close_page, wait_for } from './navigationTools';
import { evaluate_script } from './evaluateTool';
import { take_screenshot } from './screenshotTool';
import { list_console_messages, get_console_message } from './consoleTools';
import { list_network_requests, get_network_request } from './networkTools';
import { update_plan, save_finding, add_note } from './ledgerTools';
import { extract_content } from './extractTool';
import { web_search } from './searchTool';
import { task_complete } from './controlTools';

export const tools = {
  take_snapshot,
  extract_content,
  web_search,
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
  update_plan,
  save_finding,
  add_note,
  task_complete,
};

/** Ends the turn when the model decides the goal is met — see agentLoop stopWhen. */
export const TASK_COMPLETE_TOOL = 'task_complete';
