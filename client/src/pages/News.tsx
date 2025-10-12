import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Newspaper, ExternalLink } from "lucide-react";
import type { NewsItem } from "@shared/schema";

export default function News() {
  const { data: newsItems = [], isLoading } = useQuery<NewsItem[]>({
    queryKey: ["/api/news"],
  });

  const formatDate = (date: string | null) => {
    if (!date) return "Recently";
    return new Date(date).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2 flex items-center gap-3">
          <Newspaper className="w-8 h-8 text-primary" />
          Market News
        </h1>
        <p className="text-muted-foreground">Latest updates from the Indian stock market</p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-32 bg-card rounded-xl animate-pulse" />
          ))}
        </div>
      ) : newsItems.length > 0 ? (
        <div className="space-y-4" data-testid="news-list">
          {newsItems.map((item) => (
            <Card key={item.id} className="hover-elevate" data-testid={`card-news-${item.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <CardTitle className="text-lg font-semibold text-foreground leading-snug">
                    {item.title}
                  </CardTitle>
                  {item.url && (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:text-primary/80"
                      data-testid="link-news-external"
                    >
                      <ExternalLink className="w-5 h-5" />
                    </a>
                  )}
                </div>
              </CardHeader>
              {item.description && (
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3">{item.description}</p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    {item.source && <span>Source: {item.source}</span>}
                    <span>•</span>
                    <span>{formatDate(item.publishedAt)}</span>
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="pt-16 pb-16 text-center">
            <Newspaper className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold text-foreground mb-2">No News Available</h3>
            <p className="text-muted-foreground">Market news and updates will appear here</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
