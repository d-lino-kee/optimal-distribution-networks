require "httparty"
require "json"

module DistributionOptimizer
  class ApiClient
    include HTTParty

    DEFAULT_BASE_URI = "http://localhost:8080/api/v1".freeze

    def initialize(base_uri: DEFAULT_BASE_URI, timeout: 120)
      self.class.base_uri(base_uri)
      @timeout = timeout
    end

    def health
      response = self.class.get("/health", timeout: @timeout)
      handle!(response)
    end

    # Run optimization. sensitivity: true hits /optimize/sensitivity.
    def optimize(problem, sensitivity: false)
      endpoint = sensitivity ? "/optimize/sensitivity" : "/optimize"
      post!(endpoint, problem)
    end

    def create_scenario(name:, problem:)
      post!("/scenarios", { name: name, problem: problem })
    end

    def list_scenarios
      response = self.class.get("/scenarios", timeout: @timeout)
      handle!(response)
    end

    def get_scenario(scenario_id)
      response = self.class.get("/scenarios/#{scenario_id}", timeout: @timeout)
      handle!(response)
    end

    def what_if(scenario_id, demand_overrides:)
      post!("/scenarios/#{scenario_id}/whatif",
            { demand_overrides: demand_overrides })
    end

    private

    def post!(path, body)
      response = self.class.post(
        path,
        body: body.to_json,
        headers: { "Content-Type" => "application/json" },
        timeout: @timeout
      )
      handle!(response)
    end

    def handle!(response)
      raise "API error #{response.code}: #{response.body}" unless response.success?
      JSON.parse(response.body, symbolize_names: true)
    end
  end
end
