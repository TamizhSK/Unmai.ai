
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { ScoreProgress } from "./ui/score-progress";
import { Separator } from "./ui/separator";

interface Source {
  url: string;
  title: string;
}

interface ComprehensiveResponse {
  label: string;
  oneLineDescription: string;
  informationSummary: string;
  educationalInsight: string;
  trustScore: number;
  sources: Source[];
}

interface ComprehensiveResponseCardProps {
  response: ComprehensiveResponse;
}

export function ComprehensiveResponseCard({ response }: ComprehensiveResponseCardProps) {
  return (
    <Card className="w-full max-w-2xl mx-auto bg-gray-100 dark:bg-gray-800 rounded-2xl shadow-lg">
      <CardHeader>
        <CardTitle>
          <Badge className="text-lg" variant="destructive">{response.label}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div>
          <h3 className="text-lg font-semibold">One line description</h3>
          <p className="text-muted-foreground">{response.oneLineDescription}</p>
        </div>
        <Separator />
        <div>
          <h3 className="text-lg font-semibold">Information summary</h3>
          <p className="text-muted-foreground">{response.informationSummary}</p>
        </div>
        <Separator />
        <div>
          <h3 className="text-lg font-semibold">Educational insight</h3>
          <p className="text-muted-foreground">{response.educationalInsight}</p>
        </div>
        <Separator />
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold">Sources</h3>
            <div className="flex flex-col">
            {response.sources.map((source, index) => (
              <a key={index} href={source.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                {source.title}
              </a>
            ))}
            </div>
          </div>
          <div className="text-center">
            <ScoreProgress value={response.trustScore} />
            <p className="text-sm font-medium text-muted-foreground">Trust score</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
