import { FileText, FolderOpen, Image, FileCode, Download, MoreVertical, Upload } from 'lucide-react';
import { useState } from 'react';

interface FileItem {
  id: number;
  name: string;
  type: 'folder' | 'file';
  size?: string;
  modified: string;
  fileType?: 'document' | 'image' | 'code';
}

const filesData: FileItem[] = [
  { id: 1, name: 'Project Documents', type: 'folder', modified: '2 days ago' },
  { id: 2, name: 'Design Assets', type: 'folder', modified: '1 week ago' },
  { id: 3, name: 'README.md', type: 'file', size: '4.2 KB', modified: '3 hours ago', fileType: 'code' },
  { id: 4, name: 'Project Proposal.pdf', type: 'file', size: '2.4 MB', modified: '1 day ago', fileType: 'document' },
  { id: 5, name: 'Dashboard_mockup.png', type: 'file', size: '856 KB', modified: '2 days ago', fileType: 'image' },
  { id: 6, name: 'API_documentation.md', type: 'file', size: '12.8 KB', modified: '5 days ago', fileType: 'code' },
];

export function Files() {
  const [selectedFiles, setSelectedFiles] = useState<number[]>([]);

  const getFileIcon = (item: FileItem) => {
    if (item.type === 'folder') {
      return <FolderOpen className="w-5 h-5 text-[#2196F3]" />;
    }
    switch (item.fileType) {
      case 'image':
        return <Image className="w-5 h-5 text-purple-500" />;
      case 'code':
        return <FileCode className="w-5 h-5 text-green-500" />;
      default:
        return <FileText className="w-5 h-5 text-muted-foreground" />;
    }
  };

  return (
    <div className="h-full bg-background">
      {/* Page Header */}
      <div className="bg-background border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              Files
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage and organize your project files
            </p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-[#2196F3] text-white rounded-lg hover:bg-[#2196F3]/90 transition-colors shadow-sm">
            <Upload className="w-4 h-4" />
            <span className="text-sm font-medium">Upload Files</span>
          </button>
        </div>
      </div>

      {/* Files List */}
      <div className="p-6">
        <div className="bg-background rounded-xl shadow-sm border border-border overflow-hidden">
          <table className="w-full">
            <thead className="bg-background border-b border-border">
              <tr className="text-left text-sm text-muted-foreground">
                <th className="py-3 px-6 font-medium">Name</th>
                <th className="py-3 px-6 font-medium">Size</th>
                <th className="py-3 px-6 font-medium">Modified</th>
                <th className="py-3 px-6 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {filesData.map((file) => (
                <tr
                  key={file.id}
                  className="border-b border-border last:border-0 hover:bg-background transition-colors cursor-pointer"
                >
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      {getFileIcon(file)}
                      <span className="font-medium">{file.name}</span>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-sm text-muted-foreground">
                    {file.size || '—'}
                  </td>
                  <td className="py-4 px-6 text-sm text-muted-foreground">
                    {file.modified}
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-2">
                      {file.type === 'file' && (
                        <button className="p-2 hover:bg-muted/40 rounded transition-colors">
                          <Download className="w-4 h-4 text-muted-foreground" />
                        </button>
                      )}
                      <button className="p-2 hover:bg-muted/40 rounded transition-colors">
                        <MoreVertical className="w-4 h-4 text-muted-foreground" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Storage Info */}
        <div className="mt-6 bg-background rounded-xl shadow-sm border border-border p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Storage Usage</h3>
            <span className="text-sm text-muted-foreground">24.3 GB of 100 GB used</span>
          </div>
          <div className="h-3 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-[#2196F3] to-purple-500 rounded-full" style={{ width: '24.3%' }} />
          </div>
        </div>
      </div>
    </div>
  );
}
