import { Activity, AlertCircle, Cloud, Globe2 } from 'lucide-react';
import { Layout } from './components/Layout';
import { KpiCard } from './components/KpiCard';
import { TimelineChart } from './components/TimelineChart';
import { JourneyCard } from './components/JourneyCard';
import { SensorTable } from './components/SensorTable';
import { journeys } from './data/sampleData';

function App() {
  return (
    <Layout>
      <div className="grid gap-6 lg:grid-cols-4">
        <KpiCard title="Global availability" value="98.4%" change={0.8} subtitle="Rolling 7-day window" icon={<Globe2 className="h-6 w-6" />} />
        <KpiCard title="Median latency" value="62 ms" change={-3.1} subtitle="Sensor to SaaS" icon={<Activity className="h-6 w-6" />} />
        <KpiCard title="Active incidents" value="3" change={1.2} subtitle="Across 58 sensors" icon={<AlertCircle className="h-6 w-6" />} />
        <KpiCard title="Cloud ingest" value="1.8k/s" change={4.5} subtitle="Events streaming" icon={<Cloud className="h-6 w-6" />} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TimelineChart />
        </div>
        <div id="journeys" className="flex flex-col gap-4">
          {journeys.map((journey) => (
            <JourneyCard key={journey.id} journey={journey} />
          ))}
        </div>
      </div>

      <SensorTable />
    </Layout>
  );
}

export default App;
