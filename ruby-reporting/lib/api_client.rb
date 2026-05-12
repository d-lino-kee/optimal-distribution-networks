module DistributionOptimizer
  class ApiClient
    include HTTParty    # mixin: adds self.get, self.post, etc.

    DEFAULT_BASE_URI = "http://localhost:8080/api/v1"

    def initialize(base_uri: DEFAULT_BASE_URI, timeout: 120)
        # keyword arguments have name: default syntax
        self.class.base_uri(base_uri)
        @timeout = timeout  # @ prefix = instance variable
    end

    # Run optimization - sensitivity: is a keyword argument with default false
    def optimize(problem, sensitivity: false)
        endpoint = sensitivity ? "/optimize/sensitivity" : "/optimize"
        post!(endpoint, problem)
    end

    # What-if with named keyword argument
    def what_if(scenario_id, demand_overrides:)
        post!("/scenarios/#{scenario_id}/whatif",
              { demand_overrides: demand_overrides })
    end

    private   # everything below is internal

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
        raise "API error #{response.code}" unless response.success?
        JSON.parse(response.body, symbolize_names: true)
    end
end