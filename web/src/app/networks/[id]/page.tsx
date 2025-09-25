import NetworkDetailView from '@features/networks/views/NetworkDetailView';

type PageProps = {
  params: { id: string };
};

export default function NetworkPage({ params }: PageProps) {
  return <NetworkDetailView id={params.id} />;
}
