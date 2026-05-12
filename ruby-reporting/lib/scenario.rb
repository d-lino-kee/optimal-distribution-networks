module DistributionOptimizer
  # Scenario is a small DSL: callers describe demand changes inside a `define`
  # block, and `run` applies them via the Go API's what-if endpoint.
  class Scenario
    attr_reader :name, :demand_overrides

    def self.define(name, &block)
      s = new(name)
      s.instance_eval(&block) if block_given?
      s
    end

    def initialize(name)
      @name             = name
      @demand_overrides = {}
      @scale_factor     = nil
    end

    # DSL method — pin a single retailer's demand to a new absolute value.
    def demand_override(retailer_id, new_demand)
      @demand_overrides[retailer_id.to_s] = new_demand.to_f
      self
    end

    # DSL method — apply a uniform multiplier to every retailer's demand.
    def scale_all_demand(factor)
      @scale_factor = factor.to_f
      self
    end

    def run(client, base_scenario_id:)
      overrides = effective_overrides(client, base_scenario_id)
      response  = client.what_if(base_scenario_id, demand_overrides: overrides)
      ScenarioResult.new(name: @name, api_response: response)
    end

    private

    # Combine scale + explicit overrides into a single map the API can apply.
    # Explicit overrides take precedence over the scale factor.
    def effective_overrides(client, base_scenario_id)
      return @demand_overrides if @scale_factor.nil?

      baseline = client.get_scenario(base_scenario_id)
      retailers = baseline.dig(:result, :problem, :retailers) || []
      out = {}
      retailers.each do |r|
        out[r[:id].to_s] = r[:demand].to_f * @scale_factor
      end
      out.merge!(@demand_overrides) # explicit wins
      out
    end
  end

  class ScenarioResult
    attr_reader :name, :api_response

    def initialize(name:, api_response:)
      @name         = name
      @api_response = api_response
    end

    def baseline_cost = @api_response[:baseline_cost].to_f
    def whatif_cost   = @api_response[:whatif_cost].to_f
    def delta         = @api_response[:cost_delta].to_f
    def delta_pct     = @api_response[:cost_delta_pct].to_f
    def result        = @api_response[:result]

    def print_comparison
      pastel = Pastel.new
      arrow  = delta >= 0 ? pastel.red("+") : pastel.green("-")
      printf(
        "  %-25s  baseline $%10.2f  what-if $%10.2f  delta %s$%9.2f (%+.2f%%)\n",
        @name, baseline_cost, whatif_cost, arrow, delta.abs, delta_pct
      )
    end
  end
end
