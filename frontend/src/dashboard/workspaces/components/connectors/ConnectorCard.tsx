import type { ReactNode } from 'react';
import { Plug, Github, Figma, FileText, Brain, Boxes, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import type { Connector, ConnectorId, ConnectorStatus } from '../../lib/types';

const ICONS: Record<ConnectorId, ReactNode> = {
  github: <Github className="w-6 h-6" />, figma: <Figma className="w-6 h-6" />,
  notion: <FileText className="w-6 h-6" />, ml: <Brain className="w-6 h-6" />,
  web3: <Boxes className="w-6 h-6" />,
};

const STATUS_STYLES: Record<ConnectorStatus, string> = {
  connected: 'bg-green-100 text-green-700', disconnected: 'bg-gray-100 text-gray-600',
  error: 'bg-red-100 text-red-700', pending: 'bg-yellow-100 text-yellow-700',
};

interface Props {
  connector: Connector;
  onOpen: (c: Connector) => void;
  onToggle: (c: Connector) => void;
}

export function ConnectorCard({ connector, onOpen, onToggle }: Props) {
  const connected = connector.status === 'connected';
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md transition-all">
      <div className="flex items-start justify-between mb-4">
        <div className="p-3 rounded-lg bg-[#2196F3]/10 text-[#2196F3]">{ICONS[connector.id] ?? <Plug className="w-6 h-6" />}</div>
        <Badge className={STATUS_STYLES[connector.status]}>{connector.status}</Badge>
      </div>
      <h3 className="font-semibold text-lg">{connector.name}</h3>
      <p className="text-sm text-gray-500 mb-3">{connector.category} • {connector.authType}</p>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {connector.capabilities.map((c) => (<Badge key={c} variant="secondary" className="text-xs">{c}</Badge>))}
      </div>
      <p className="text-xs text-gray-500 mb-4">{connector.tools.length} MCP tools exposed</p>
      <div className="flex items-center gap-2">
        <Button variant="outline" className="flex-1" onClick={() => onOpen(connector)}>Details</Button>
        {connector.deepLink ? (
          <Button asChild variant="ghost"><Link to={connector.deepLink}><ExternalLink className="w-4 h-4 mr-1" />Open</Link></Button>
        ) : (
          <Button className={connected ? 'bg-gray-200 text-gray-700 hover:bg-gray-300' : 'bg-[#2196F3] hover:bg-[#1976D2]'} onClick={() => onToggle(connector)}>
            {connected ? 'Disconnect' : 'Connect'}
          </Button>
        )}
      </div>
    </div>
  );
}
