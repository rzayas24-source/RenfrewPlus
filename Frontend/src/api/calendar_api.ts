import axios from "axios";

const API = "http://127.0.0.1:8000";

export interface CalendarStatus {
  today: string;
  currentWorkDay: string | null;
  currentBankDay: string | null;
  todayBankDay: string | null;
  nextOpenWorkDay: string | null;
  lastBankDay: string | null;
  totalDays: number;
  openDays: number;
  closedDays: number;
}

export interface CalendarRangeRow {
  bankDay: string;
  weekday: string | null;
  isClosed: boolean;
  closureReason: string;
  paperworkDay: string | null;
  isCurrentWorkDay: boolean;
  lockboxTotal: number;
  lockboxCount: number;
  eftTotal: number;
  eftCount: number;
  combinedTotal: number;
}

export interface CalendarRange {
  start: string;
  end: string;
  currentWorkDay: string | null;
  rows: CalendarRangeRow[];
}

export interface CalendarWorkDayLookup {
  workDay: string;
  bankDay: string | null;
}

export const getCalendarStatus = () => axios.get<CalendarStatus>(`${API}/calendar/status`);

export const lookupCalendarBankDay = (work_day: string) =>
  axios.get<CalendarWorkDayLookup>(`${API}/calendar/work-day/lookup`, { params: { work_day } });

export const getCalendarRange = (start: string, end: string) =>
  axios.get<CalendarRange>(`${API}/calendar/range`, { params: { start, end } });

export const setupCalendar = (start_date: string) =>
  axios.post<CalendarStatus>(`${API}/calendar/setup`, { start_date });

export const addCalendarDays = (days: number) =>
  axios.post<CalendarStatus>(`${API}/calendar/add`, { days });

export const buildCalendarFrom = (start_date: string, days: number) =>
  axios.post<CalendarStatus>(`${API}/calendar/build-from`, { start_date, days });

export const deleteCalendarDays = (from_date: string, to_date: string) =>
  axios.delete<CalendarStatus>(`${API}/calendar/days`, { params: { from_date, to_date } });

export const setCalendarWorkDay = (work_day: string) =>
  axios.post<CalendarStatus>(`${API}/calendar/work-day/set`, { work_day });

export const advanceCalendarWorkDay = () =>
  axios.post<CalendarStatus>(`${API}/calendar/work-day/advance`);
