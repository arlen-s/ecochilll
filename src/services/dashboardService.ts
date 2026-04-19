import {
  buildPresentationScript,
  buildRuntimeMeta,
  buildScenarioData,
} from '@/mock/energyMock';
import type {
  DashboardRuntimeMeta,
  DashboardScenarioData,
  DataSourceMode,
  PresentationChapter,
  ScenarioMode,
} from '@/types/energy';

export interface DashboardService {
  getScenarioData(scenario: ScenarioMode): Promise<DashboardScenarioData>;
  getPresentationChapters(): Promise<PresentationChapter[]>;
  getRuntimeMeta(): Promise<DashboardRuntimeMeta>;
}

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

const fetchJson = async <T>(input: string): Promise<T> => {
  const response = await fetch(input, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
};

class MockDashboardService implements DashboardService {
  async getScenarioData(scenario: ScenarioMode): Promise<DashboardScenarioData> {
    await wait(120);
    return buildScenarioData(scenario);
  }

  async getPresentationChapters(): Promise<PresentationChapter[]> {
    await wait(80);
    return buildPresentationScript();
  }

  async getRuntimeMeta(): Promise<DashboardRuntimeMeta> {
    await wait(50);
    return buildRuntimeMeta('mock');
  }
}

class HttpDashboardService implements DashboardService {
  constructor(private readonly baseUrl: string) {}

  async getScenarioData(scenario: ScenarioMode): Promise<DashboardScenarioData> {
    return fetchJson<DashboardScenarioData>(`${this.baseUrl}/dashboard/scenario?mode=${scenario}`);
  }

  async getPresentationChapters(): Promise<PresentationChapter[]> {
    return fetchJson<PresentationChapter[]>(`${this.baseUrl}/dashboard/presentation`);
  }

  async getRuntimeMeta(): Promise<DashboardRuntimeMeta> {
    return fetchJson<DashboardRuntimeMeta>(`${this.baseUrl}/dashboard/runtime`);
  }
}

export const resolveDashboardDataSource = (): DataSourceMode =>
  import.meta.env.VITE_DASHBOARD_DATA_SOURCE === 'api' ? 'api' : 'mock';

const resolveDashboardService = (): DashboardService => {
  const dataSource = resolveDashboardDataSource();

  if (dataSource === 'api') {
    const baseUrl = import.meta.env.VITE_DASHBOARD_API_BASE || '/api';
    return new HttpDashboardService(baseUrl);
  }

  return new MockDashboardService();
};

export const dashboardService = resolveDashboardService();
