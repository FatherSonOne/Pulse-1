/**
 * Predictive Analytics Service
 * ML-powered predictions for relationship trends, burnout risk, and communication patterns
 */

import { supabase } from './supabase';

export interface PredictionCache {
  id: string;
  user_id: string;
  prediction_type: string;
  subject_type: 'user' | 'contact' | 'relationship' | 'team';
  subject_identifier: string | null;
  prediction_value: number | null;
  confidence_level: number | null;
  prediction_label: string | null;
  factors: Record<string, any>;
  recommendations: string[];
  predicted_at: string;
  valid_until: string | null;
  expires_at: string | null;
  outcome_tracked: boolean;
  actual_outcome: string | null;
  prediction_accuracy: number | null;
  created_at: string;
}

export interface BurnoutIndicator {
  id: string;
  user_id: string;
  burnout_risk_score: number;
  risk_level: 'low' | 'moderate' | 'high' | 'critical';
  avg_response_time_increasing: boolean;
  message_volume_increasing: boolean;
  sentiment_declining: boolean;
  working_hours_extending: boolean;
  weekend_activity_high: boolean;
  response_quality_dropping: boolean;
  messages_per_day_7d: number | null;
  messages_per_day_30d: number | null;
  avg_response_time_7d: number | null;
  avg_response_time_30d: number | null;
  recommended_actions: string[];
  assessed_at: string;
  created_at: string;
}

export interface MLTrainingData {
  id: string;
  user_id: string;
  features: Record<string, any>;
  outcome_type: string;
  outcome_value: boolean | null;
  outcome_timestamp: string | null;
  data_point_date: string;
  created_at: string;
}

export interface PredictionResult {
  prediction_type: string;
  value: number;
  confidence: number;
  label: string;
  factors: Record<string, any>;
  recommendations: string[];
}

/**
 * Get all predictions for current user
 */
export async function getAllPredictions(
  predictionType?: string,
  validOnly: boolean = true
): Promise<{
  success: boolean;
  data?: PredictionCache[];
  error?: string;
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    let query = supabase
      .from('predictions_cache')
      .select('*')
      .eq('user_id', user.id)
      .order('predicted_at', { ascending: false });

    if (predictionType) {
      query = query.eq('prediction_type', predictionType);
    }

    if (validOnly) {
      query = query.gte('valid_until', new Date().toISOString());
    }

    const { data, error } = await query;

    if (error) throw error;

    return { success: true, data: data || [] };
  } catch (err: any) {
    console.error('Error fetching predictions:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Get latest burnout indicator
 */
export async function getLatestBurnoutIndicator(): Promise<{
  success: boolean;
  data?: BurnoutIndicator;
  error?: string;
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    const { data, error } = await supabase
      .from('burnout_indicators')
      .select('*')
      .eq('user_id', user.id)
      .order('assessed_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    return { success: true, data: data || undefined };
  } catch (err: any) {
    console.error('Error fetching burnout indicator:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Get burnout history
 * @deprecated No consumers — not called from any component as of 2026-04-02
 */
export async function getBurnoutHistory(
  days: number = 30
): Promise<{
  success: boolean;
  data?: BurnoutIndicator[];
  error?: string;
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data, error } = await supabase
      .from('burnout_indicators')
      .select('*')
      .eq('user_id', user.id)
      .gte('assessed_at', startDate.toISOString())
      .order('assessed_at', { ascending: true });

    if (error) throw error;

    return { success: true, data: data || [] };
  } catch (err: any) {
    console.error('Error fetching burnout history:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Calculate and store burnout risk assessment
 */
export async function assessBurnoutRisk(): Promise<{
  success: boolean;
  data?: BurnoutIndicator;
  error?: string;
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    // Get recent metrics
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const { data: metrics7d, error: error7d } = await supabase
      .from('analytics_daily_metrics')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', sevenDaysAgo.toISOString().split('T')[0])
      .order('date', { ascending: true });

    if (error7d) throw error7d;

    const { data: metrics30d, error: error30d } = await supabase
      .from('analytics_daily_metrics')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', thirtyDaysAgo.toISOString().split('T')[0])
      .order('date', { ascending: true });

    if (error30d) throw error30d;

    // Calculate metrics
    const metrics7 = metrics7d || [];
    const metrics30 = metrics30d || [];

    const messagesPerDay7d = metrics7.length > 0
      ? metrics7.reduce((sum, m) => sum + m.messages_sent + m.messages_received, 0) / metrics7.length
      : 0;

    const messagesPerDay30d = metrics30.length > 0
      ? metrics30.reduce((sum, m) => sum + m.messages_sent + m.messages_received, 0) / metrics30.length
      : 0;

    const avgResponseTime7d = metrics7.length > 0
      ? metrics7.reduce((sum, m) => sum + (m.avg_response_time_minutes || 0), 0) / metrics7.length
      : 0;

    const avgResponseTime30d = metrics30.length > 0
      ? metrics30.reduce((sum, m) => sum + (m.avg_response_time_minutes || 0), 0) / metrics30.length
      : 0;

    // Detect burnout indicators
    const avgResponseTimeIncreasing = avgResponseTime7d > avgResponseTime30d * 1.3;
    const messageVolumeIncreasing = messagesPerDay7d > messagesPerDay30d * 1.5;

    // Check sentiment decline
    const avgSentiment7d = metrics7.length > 0
      ? metrics7.reduce((sum, m) => sum + (m.avg_sentiment_score || 0), 0) / metrics7.length
      : 0;
    const avgSentiment30d = metrics30.length > 0
      ? metrics30.reduce((sum, m) => sum + (m.avg_sentiment_score || 0), 0) / metrics30.length
      : 0;
    const sentimentDeclining = avgSentiment7d < avgSentiment30d - 0.2;

    // Check working hours (messages outside 9-5)
    const afterHoursMessages = metrics7.reduce((sum, m) => {
      const hourlyMessages = m.messages_by_hour as Record<string, number> || {};
      const afterHours = Object.entries(hourlyMessages)
        .filter(([hour]) => parseInt(hour) < 9 || parseInt(hour) >= 17)
        .reduce((s, [, count]) => s + count, 0);
      return sum + afterHours;
    }, 0);
    const totalMessages7d = messagesPerDay7d * 7;
    const workingHoursExtending = totalMessages7d > 0 && afterHoursMessages / totalMessages7d > 0.3;

    // Check weekend activity
    const weekendMessages = metrics7.reduce((sum, m) => {
      const date = new Date(m.date);
      const dayOfWeek = date.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        return sum + m.messages_sent + m.messages_received;
      }
      return sum;
    }, 0);
    const weekendActivityHigh = totalMessages7d > 0 && weekendMessages / totalMessages7d > 0.25;

    // Response quality (based on response time consistency)
    const responseTimesVariance = metrics7.reduce((sum, m) => {
      if (m.avg_response_time_minutes) {
        return sum + Math.abs(m.avg_response_time_minutes - avgResponseTime7d);
      }
      return sum;
    }, 0) / (metrics7.length || 1);
    const responseQualityDropping = responseTimesVariance > avgResponseTime7d * 0.5;

    // Calculate burnout risk score (0-100)
    let riskScore = 0;
    if (avgResponseTimeIncreasing) riskScore += 20;
    if (messageVolumeIncreasing) riskScore += 15;
    if (sentimentDeclining) riskScore += 25;
    if (workingHoursExtending) riskScore += 15;
    if (weekendActivityHigh) riskScore += 15;
    if (responseQualityDropping) riskScore += 10;

    // Determine risk level
    let riskLevel: 'low' | 'moderate' | 'high' | 'critical';
    if (riskScore >= 70) riskLevel = 'critical';
    else if (riskScore >= 50) riskLevel = 'high';
    else if (riskScore >= 30) riskLevel = 'moderate';
    else riskLevel = 'low';

    // Generate recommendations
    const recommendations: string[] = [];
    if (avgResponseTimeIncreasing) {
      recommendations.push('Your response times are increasing. Consider setting aside dedicated time blocks for messages.');
    }
    if (messageVolumeIncreasing) {
      recommendations.push('Message volume is rising. Review your communication workflows and consider automation.');
    }
    if (sentimentDeclining) {
      recommendations.push('Sentiment is declining. Take breaks and practice stress management techniques.');
    }
    if (workingHoursExtending) {
      recommendations.push('You\'re working extended hours. Set boundaries and establish clear work-life separation.');
    }
    if (weekendActivityHigh) {
      recommendations.push('High weekend activity detected. Protect your weekends for rest and recovery.');
    }
    if (responseQualityDropping) {
      recommendations.push('Response consistency is declining. Focus on quality over quantity in communications.');
    }

    if (riskLevel === 'low') {
      recommendations.push('Your communication patterns are healthy. Keep maintaining good work-life balance!');
    }

    // Store assessment
    const { data, error } = await supabase
      .from('burnout_indicators')
      .insert({
        user_id: user.id,
        burnout_risk_score: riskScore,
        risk_level: riskLevel,
        avg_response_time_increasing: avgResponseTimeIncreasing,
        message_volume_increasing: messageVolumeIncreasing,
        sentiment_declining: sentimentDeclining,
        working_hours_extending: workingHoursExtending,
        weekend_activity_high: weekendActivityHigh,
        response_quality_dropping: responseQualityDropping,
        messages_per_day_7d: messagesPerDay7d,
        messages_per_day_30d: messagesPerDay30d,
        avg_response_time_7d: avgResponseTime7d,
        avg_response_time_30d: avgResponseTime30d,
        recommended_actions: recommendations,
        assessed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    return { success: true, data };
  } catch (err: any) {
    console.error('Error assessing burnout risk:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Predict relationship health trend
 * @deprecated No consumers — not called from any component as of 2026-04-02
 */
export async function predictRelationshipTrend(
  contactIdentifier: string
): Promise<{
  success: boolean;
  data?: PredictionResult;
  error?: string;
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    // Get relationship health data
    const { data: relationship, error: relError } = await supabase
      .from('relationship_health')
      .select('*')
      .eq('user_id', user.id)
      .eq('contact_identifier', contactIdentifier)
      .single();

    if (relError) throw relError;

    // Get contact engagement data
    const { data: engagement, error: engError } = await supabase
      .from('analytics_contact_engagement')
      .select('*')
      .eq('user_id', user.id)
      .eq('contact_identifier', contactIdentifier)
      .single();

    if (engError) throw engError;

    // Calculate prediction factors
    const factors = {
      current_health_score: relationship.health_score,
      days_since_last_message: relationship.days_since_last_message,
      sentiment_trend: relationship.sentiment_trend,
      engagement_trend: engagement.engagement_trend,
      message_count_30d: relationship.message_count_30d,
      response_reciprocity: relationship.response_reciprocity_score,
    };

    // Simple prediction algorithm (in production, use ML model)
    let trendScore = relationship.health_score;

    // Adjust based on trends
    if (relationship.sentiment_trend === 'improving') trendScore += 10;
    else if (relationship.sentiment_trend === 'declining') trendScore -= 15;

    if (engagement.engagement_trend === 'rising') trendScore += 10;
    else if (engagement.engagement_trend === 'falling') trendScore -= 15;

    // Adjust based on recency
    if (relationship.days_since_last_message > 14) trendScore -= 20;
    else if (relationship.days_since_last_message <= 3) trendScore += 5;

    // Normalize to 0-100
    trendScore = Math.max(0, Math.min(100, trendScore));

    // Determine label
    let label: string;
    if (trendScore >= 80) label = 'Strong & Growing';
    else if (trendScore >= 60) label = 'Stable';
    else if (trendScore >= 40) label = 'Needs Attention';
    else label = 'At Risk';

    // Calculate confidence (based on data recency and volume)
    const dataRecency = relationship.days_since_last_message <= 7 ? 0.9 : 0.6;
    const dataVolume = relationship.message_count_30d >= 10 ? 0.9 : 0.5;
    const confidence = (dataRecency + dataVolume) / 2;

    // Generate recommendations
    const recommendations: string[] = [];
    if (trendScore < 60) {
      recommendations.push('Schedule a check-in with this contact soon');
    }
    if (relationship.sentiment_trend === 'declining') {
      recommendations.push('Recent sentiment is declining - consider a more personal touch');
    }
    if (relationship.days_since_last_message > 7) {
      recommendations.push('It\'s been a while - reach out to maintain the connection');
    }

    const prediction: PredictionResult = {
      prediction_type: 'relationship_trend',
      value: trendScore,
      confidence: confidence,
      label,
      factors,
      recommendations,
    };

    // Cache prediction
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + 7);

    await supabase
      .from('predictions_cache')
      .insert({
        user_id: user.id,
        prediction_type: 'relationship_trend',
        subject_type: 'relationship',
        subject_identifier: contactIdentifier,
        prediction_value: trendScore,
        confidence_level: confidence,
        prediction_label: label,
        factors,
        recommendations,
        predicted_at: new Date().toISOString(),
        valid_until: validUntil.toISOString(),
        outcome_tracked: false,
      });

    return { success: true, data: prediction };
  } catch (err: any) {
    console.error('Error predicting relationship trend:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Predict response time for a contact
 * @deprecated No consumers — not called from any component as of 2026-04-02
 */
export async function predictResponseTime(
  contactIdentifier: string
): Promise<{
  success: boolean;
  data?: PredictionResult;
  error?: string;
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    // Get contact engagement data
    const { data: engagement, error: engError } = await supabase
      .from('analytics_contact_engagement')
      .select('*')
      .eq('user_id', user.id)
      .eq('contact_identifier', contactIdentifier)
      .single();

    if (engError) throw engError;

    // Get recent response times
    const { data: responseTimes, error: rtError } = await supabase
      .from('analytics_response_times')
      .select('response_time_minutes, is_business_hours')
      .eq('user_id', user.id)
      .eq('contact_identifier', contactIdentifier)
      .order('incoming_at', { ascending: false })
      .limit(10);

    if (rtError) throw rtError;

    const recentTimes = responseTimes || [];
    const avgRecentTime = recentTimes.length > 0
      ? recentTimes.reduce((sum, rt) => sum + rt.response_time_minutes, 0) / recentTimes.length
      : engagement.avg_response_time_minutes || 60;

    // Check time of day effect
    const currentHour = new Date().getHours();
    const isBusinessHours = currentHour >= 9 && currentHour < 17;

    const businessHoursTimes = recentTimes.filter(rt => rt.is_business_hours);
    const avgBusinessHoursTime = businessHoursTimes.length > 0
      ? businessHoursTimes.reduce((sum, rt) => sum + rt.response_time_minutes, 0) / businessHoursTimes.length
      : avgRecentTime;

    const predictedTime = isBusinessHours ? avgBusinessHoursTime : avgRecentTime * 1.5;

    const factors = {
      avg_response_time: engagement.avg_response_time_minutes,
      recent_avg: avgRecentTime,
      is_business_hours: isBusinessHours,
      contact_response_rate: engagement.response_rate,
    };

    const confidence = recentTimes.length >= 5 ? 0.8 : 0.5;

    let label: string;
    if (predictedTime <= 30) label = 'Quick Response Expected';
    else if (predictedTime <= 120) label = 'Normal Response Time';
    else if (predictedTime <= 1440) label = 'May Take Several Hours';
    else label = 'May Take Days';

    const recommendations: string[] = [];
    if (predictedTime > 240) {
      recommendations.push('This contact typically takes longer to respond - be patient');
    }
    if (!isBusinessHours) {
      recommendations.push('Sending outside business hours - expect delayed response');
    }

    const prediction: PredictionResult = {
      prediction_type: 'response_time',
      value: predictedTime,
      confidence,
      label,
      factors,
      recommendations,
    };

    // Cache prediction
    const validUntil = new Date();
    validUntil.setHours(validUntil.getHours() + 24);

    await supabase
      .from('predictions_cache')
      .insert({
        user_id: user.id,
        prediction_type: 'response_time',
        subject_type: 'contact',
        subject_identifier: contactIdentifier,
        prediction_value: predictedTime,
        confidence_level: confidence,
        prediction_label: label,
        factors,
        recommendations,
        predicted_at: new Date().toISOString(),
        valid_until: validUntil.toISOString(),
        outcome_tracked: false,
      });

    return { success: true, data: prediction };
  } catch (err: any) {
    console.error('Error predicting response time:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Store ML training data
 * @deprecated No consumers — not called from any component as of 2026-04-02
 */
export async function storeTrainingData(
  features: Record<string, any>,
  outcomeType: string,
  outcomeValue: boolean,
  outcomeTimestamp?: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    const { error } = await supabase
      .from('ml_training_data')
      .insert({
        user_id: user.id,
        features,
        outcome_type: outcomeType,
        outcome_value: outcomeValue,
        outcome_timestamp: outcomeTimestamp || new Date().toISOString(),
        data_point_date: new Date().toISOString().split('T')[0],
      });

    if (error) throw error;

    return { success: true };
  } catch (err: any) {
    console.error('Error storing training data:', err);
    return { success: false, error: err.message };
  }
}
