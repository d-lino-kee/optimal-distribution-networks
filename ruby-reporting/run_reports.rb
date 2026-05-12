#!/usr/bin/env ruby
$LOAD_PATH.unshift(File.join(__dir__, "lib"))

require "api_client"
require "reporter"
require "scenario"
require "json"
require "fileutils"

PROBLEM_PATH = File.expand_path("../rust-solver/sample_problem.json", __dir__)
OUTPUT_DIR   = File.join(__dir__, "output")
FileUtils.mkdir_p(OUTPUT_DIR)

problem = JSON.parse(File.read(PROBLEM_PATH), symbolize_names: true)

client = DistributionOptimizer::ApiClient.new(
  base_uri: ENV.fetch("API_BASE_URI", DistributionOptimizer::ApiClient::DEFAULT_BASE_URI)
)

# 1. Baseline optimization with sensitivity analysis
result = client.optimize(problem, sensitivity: true)
reporter = DistributionOptimizer::Reporter.new(result)
reporter.print_summary
reporter.export_csv(File.join(OUTPUT_DIR, "baseline_result.csv"))
reporter.export_pdf(File.join(OUTPUT_DIR, "baseline_result.pdf"))

# 2. Save as a named scenario so we can run what-ifs against it
saved       = client.create_scenario(name: "Baseline 2024", problem: problem)
scenario_id = saved[:scenario_id]

# 3. Define and run what-if scenarios using the DSL
scenarios = [
  DistributionOptimizer::Scenario.define("Q4 surge") do
    scale_all_demand(1.25)
  end,

  DistributionOptimizer::Scenario.define("NYC + LA spike") do
    demand_override "ret_nyc", 2800
    demand_override "ret_la",  3200
  end,

  DistributionOptimizer::Scenario.define("Houston drop") do
    demand_override "ret_houston", 1050
  end
]

puts
puts "What-if comparisons:"
scenarios.each do |scenario|
  scenario_result = scenario.run(client, base_scenario_id: scenario_id)
  scenario_result.print_comparison
end
