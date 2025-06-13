import { Server } from 'lucide-react';

const AppHeader = () => {
  return (
    <header className="py-6 px-4 md:px-6 border-b">
      <div className="container mx-auto flex items-center gap-3">
        <Server className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-headline font-bold text-foreground">
          FileSync UI
        </h1>
      </div>
    </header>
  );
};

export default AppHeader;
