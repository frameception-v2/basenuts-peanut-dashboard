"use client";

import { useEffect, useCallback, useState } from "react";
import sdk, {
  AddFrame,
  SignIn as SignInCore,
  type Context,
} from "@farcaster/frame-sdk";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "~/components/ui/card";

import { config } from "~/components/providers/WagmiProvider";
import { truncateAddress } from "~/lib/truncateAddress";
import { base, optimism } from "wagmi/chains";
import { useSession } from "next-auth/react";
import { createStore } from "mipd";
import { Label } from "~/components/ui/label";
import { PROJECT_TITLE } from "~/lib/constants";

function NutsStatsCard({ userFid }: { userFid?: number }) {
  const [stats, setStats] = useState<{
    sent: number;
    received: number;
    dailyReceived: number;
    lastUpdated: Date;
    failedAttempts: number;
  }>();
  const [dailyAllowance, setDailyAllowance] = useState(30);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [searchFid, setSearchFid] = useState('');
  const [currentView, setCurrentView] = useState<'stats' | 'leaderboard' | 'search'>('stats');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Calculate time until next allowance reset
  const now = new Date();
  const resetTime = new Date(now);
  resetTime.setUTCHours(11, 0, 0, 0);
  if (resetTime < now) resetTime.setDate(resetTime.getDate() + 1);
  const timeUntilReset = resetTime.getTime() - now.getTime();

  // Reset daily allowance at 11:00 UTC
  useEffect(() => {
    const checkReset = () => {
      const now = new Date();
      if (now.getUTCHours() === 11 && now.getUTCMinutes() === 0) {
        setDailyAllowance(30);
      }
    };
    
    const interval = setInterval(checkReset, 60000);
    return () => clearInterval(interval);
  }, []);

  // Fetch peanut stats
  const fetchNutStats = useCallback(async (fid: number) => {
    setIsLoading(true);
    setError('');
    try {
      const response = await fetch(
        `https://api.neynar.com/v2/farcaster/cast/search?q=🥜&channel_id=${NUTS_CHANNEL_ID}&priority_mode=true&after=2025-02-01`,
        {
          headers: {
            'api-key': NEYNAR_API_KEY,
            'content-type': 'application/json'
          }
        }
      );

      if (!response.ok) throw new Error('Failed to fetch peanut data');
      
      const data = await response.json();
      const casts = data.result.casts;

      // Calculate stats
      const sent = casts.filter((cast: any) => 
        cast.author.fid === fid && cast.text.includes('🥜')).length;
      const received = casts.filter((cast: any) => 
        cast.parent_author?.fid === fid && cast.text.includes('🥜')).length;
      const dailyReceived = casts.filter((cast: any) => 
        cast.parent_author?.fid === fid && 
        new Date(cast.timestamp) > new Date(now.setHours(0,0,0,0)) &&
        cast.text.includes('🥜')).length;

      setStats({
        sent,
        received,
        dailyReceived,
        failedAttempts: Math.max(0, dailyReceived - 30),
        lastUpdated: new Date()
      });
    } catch (err) {
      setError('Failed to load peanut stats. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch leaderboard
  const fetchLeaderboard = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `https://api.neynar.com/v2/farcaster/cast/search?q=🥜&channel_id=${NUTS_CHANNEL_ID}&limit=20`,
        {
          headers: {
            'api-key': NEYNAR_API_KEY,
            'content-type': 'application/json'
          }
        }
      );

      if (!response.ok) throw new Error('Failed to fetch leaderboard');
      
      const data = await response.json();
      const casts = data.result.casts;
      
      // Process leaderboard data
      const leaderboardData = casts.reduce((acc: any, cast: any) => {
        const fid = cast.author.fid;
        if (!acc[fid]) {
          acc[fid] = {
            fid,
            username: cast.author.username,
            sent: 0,
            received: 0
          };
        }
        acc[fid].sent++;
        return acc;
      }, {});

      setLeaderboard(Object.values(leaderboardData).sort((a: any, b: any) => b.sent - a.sent));
    } catch (err) {
      setError('Failed to load leaderboard. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (userFid) {
      fetchNutStats(userFid);
    }
  }, [userFid, fetchNutStats]);

  return (
    <Card className="bg-purple-50 dark:bg-purple-900 border-purple-200">
      <CardHeader>
        <CardTitle className="text-purple-600 dark:text-purple-200">
          🥜 Peanut Stats
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-4">
          <Button 
            variant={currentView === 'stats' ? 'default' : 'outline'}
            onClick={() => setCurrentView('stats')}
            className="bg-purple-500 hover:bg-purple-600 text-white"
          >
            My Stats
          </Button>
          <Button
            variant={currentView === 'leaderboard' ? 'default' : 'outline'}
            onClick={() => {
              setCurrentView('leaderboard');
              fetchLeaderboard();
            }}
            className="bg-purple-500 hover:bg-purple-600 text-white"
          >
            Leaderboard
          </Button>
          <Button
            variant={currentView === 'search' ? 'default' : 'outline'}
            onClick={() => setCurrentView('search')}
            className="bg-purple-500 hover:bg-purple-600 text-white"
          >
            Search FID
          </Button>
        </div>

        {isLoading && <div className="text-center">Loading peanut data... 🥜</div>}
        {error && <div className="text-red-500 text-center">{error}</div>}

        {currentView === 'stats' && stats && (
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Sent Peanuts:</span>
              <span className="font-bold text-purple-600">{stats.sent}</span>
            </div>
            <div className="flex justify-between">
              <span>Received Peanuts:</span>
              <span className="font-bold text-purple-600">{stats.received}</span>
            </div>
            <div className="flex justify-between">
              <span>Today's Peanuts:</span>
              <span className="font-bold text-purple-600">{stats.dailyReceived}/30</span>
            </div>
            <div className="flex justify-between">
              <span>Failed Attempts:</span>
              <span className="font-bold text-red-500">{stats.failedAttempts}</span>
            </div>
            <div className="text-sm text-gray-500 text-center mt-4">
              Next allowance reset in {Math.floor(timeUntilReset / 3600000)}h 
              {Math.floor((timeUntilReset % 3600000) / 60000)}m
            </div>
          </div>
        )}

        {currentView === 'leaderboard' && (
          <div className="space-y-2">
            <h3 className="font-bold text-lg mb-2">Top Peanut Senders</h3>
            {leaderboard.map((user: any, index: number) => (
              <div key={user.fid} className="flex justify-between items-center">
                <span>
                  {index + 1}. {user.username} (FID: {user.fid})
                </span>
                <span className="font-bold text-purple-600">{user.sent} 🥜</span>
              </div>
            ))}
          </div>
        )}

        {currentView === 'search' && (
          <div className="space-y-4">
            <input
              type="number"
              value={searchFid}
              onChange={(e) => setSearchFid(e.target.value)}
              placeholder="Enter FID to search"
              className="w-full p-2 border rounded"
            />
            <Button
              onClick={() => fetchNutStats(Number(searchFid))}
              className="w-full bg-purple-500 hover:bg-purple-600 text-white"
            >
              Search
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Frame() {
  const [isSDKLoaded, setIsSDKLoaded] = useState(false);
  const [context, setContext] = useState<Context.FrameContext>();

  const [added, setAdded] = useState(false);

  const [addFrameResult, setAddFrameResult] = useState("");

  const addFrame = useCallback(async () => {
    try {
      await sdk.actions.addFrame();
    } catch (error) {
      if (error instanceof AddFrame.RejectedByUser) {
        setAddFrameResult(`Not added: ${error.message}`);
      }

      if (error instanceof AddFrame.InvalidDomainManifest) {
        setAddFrameResult(`Not added: ${error.message}`);
      }

      setAddFrameResult(`Error: ${error}`);
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      const context = await sdk.context;
      if (!context) {
        return;
      }

      setContext(context);
      setAdded(context.client.added);

      // If frame isn't already added, prompt user to add it
      if (!context.client.added) {
        addFrame();
      }

      sdk.on("frameAdded", ({ notificationDetails }) => {
        setAdded(true);
      });

      sdk.on("frameAddRejected", ({ reason }) => {
        console.log("frameAddRejected", reason);
      });

      sdk.on("frameRemoved", () => {
        console.log("frameRemoved");
        setAdded(false);
      });

      sdk.on("notificationsEnabled", ({ notificationDetails }) => {
        console.log("notificationsEnabled", notificationDetails);
      });
      sdk.on("notificationsDisabled", () => {
        console.log("notificationsDisabled");
      });

      sdk.on("primaryButtonClicked", () => {
        console.log("primaryButtonClicked");
      });

      console.log("Calling ready");
      sdk.actions.ready({});

      // Set up a MIPD Store, and request Providers.
      const store = createStore();

      // Subscribe to the MIPD Store.
      store.subscribe((providerDetails) => {
        console.log("PROVIDER DETAILS", providerDetails);
        // => [EIP6963ProviderDetail, EIP6963ProviderDetail, ...]
      });
    };
    if (sdk && !isSDKLoaded) {
      console.log("Calling load");
      setIsSDKLoaded(true);
      load();
      return () => {
        sdk.removeAllListeners();
      };
    }
  }, [isSDKLoaded, addFrame]);

  if (!isSDKLoaded) {
    return <div>Loading...</div>;
  }

  return (
    <div
      style={{
        paddingTop: context?.client.safeAreaInsets?.top ?? 0,
        paddingBottom: context?.client.safeAreaInsets?.bottom ?? 0,
        paddingLeft: context?.client.safeAreaInsets?.left ?? 0,
        paddingRight: context?.client.safeAreaInsets?.right ?? 0,
      }}
    >
      <div className="w-[380px] mx-auto py-2 px-2">
        <h1 className="text-2xl font-bold text-center mb-4 text-purple-600 dark:text-purple-300">
          🥜 {PROJECT_TITLE}
        </h1>
        <NutsStatsCard userFid={context?.frame?.fid} />
      </div>
    </div>
  );
}
